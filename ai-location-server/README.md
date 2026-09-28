# AI 辅助定位服务

独立于 DTS 运行，使用 Chrys 的 `icode run --json` 调用只读 `Explore` Agent。服务负责分析任务、进度、定向提问、回答后的续跑、反馈、统计和参数。DTS 后端仅发送问题快照、代理已认证页面请求，并将 AI 提问写入现有站内通知；AI 的记录不写入 DTS 问题状态机。

## 模块边界

| 模块 | 职责 |
| --- | --- |
| `server.mjs` / `config.mjs` | HTTP 鉴权、路由、部署配置和启动 |
| `location-service.mjs` | 问题快照、任务排队、续跑、提问、反馈、统计；持有定位状态 |
| `agent.mjs` | Chrys / Mock 执行、检索候选与来源校验 |
| `repositories.mjs` / `operations.mjs` | 仓库清单、有限并发检索、只读状态检查和负载计算 |
| `contracts.mjs` / `store.mjs` | 共享快照字段白名单、单文件持久化 |
| `cli.mjs` | 运维 API 客户端、补录和固定仓库操作 |

DTS 的 `AiLocationBridge` 负责 HTTP 接入，`AiLocationController` 负责现有用户与管理员权限，`AiLocationNotificationService` 负责站内通知。前端通过 DTS API 访问服务，管理组件位于 `frontend/src/components/ai-location/`，问题侧组件位于 `frontend/src/components/issue/ai-location-panel.tsx`。

依赖方向为 DTS / CLI → HTTP 接口 → 定位服务 → Agent、资料和存储。独立服务不导入 DTS 的代码或数据库模型。问题保存事务结束后再投递快照，回答与定位历史由定位服务持久化；通知投递具有重试，不跨两侧数据库事务。

## 本地运行

要求 Node.js 24、`uv`、`rg` 和本机可运行的 Chrys。默认监听 `127.0.0.1:8091`，默认执行真实 Chrys。首次体验可显式设置 `AI_LOCATION_MODE=mock`，此模式不会调用模型或检索真实仓库。

```powershell
cd ai-location-server
$env:AI_LOCATION_MODE='mock'
$env:AI_LOCATION_CALLBACK_URL='http://127.0.0.1:8080/api/ai-location/internal/questions'
npm start
```

在 DTS 后端设置 `APP_AI_LOCATION_ENABLED=true`、`APP_AI_LOCATION_URL=http://127.0.0.1:8091`。两侧使用相同的 `AI_LOCATION_KEY` / `APP_AI_LOCATION_KEY`。本地回环开发默认值为 `local-dev-ai-key`；部署到其他主机时必须显式设置强随机密钥，并通过内网或 TLS 连接。服务数据默认放在 `data/state.json`，部署时应设置 `AI_LOCATION_DATA` 到持久卷；该文件包含问题描述和回答，需要按问题数据等级保护。

真实执行还需要：

- `AI_LOCATION_CHRYS_PATH`：Chrys 项目目录，默认 `../../chrys`。
- `AI_LOCATION_CODE_ROOT`：被定位代码的只读工作副本，默认 DTS-DEV。
- `AI_LOCATION_KNOWLEDGE_ROOT`：可选经验资料目录。
- `AI_LOCATION_AGENT`：Agent 配置名，默认 Chrys 的只读 `Explore`。
- `AI_LOCATION_UV_COMMAND`：`uv` 命令路径，默认 `uv`。
- `AI_LOCATION_CALLBACK_URL`：DTS 内部提问通知回调地址。未设置时问题仍保存在服务内，但不会推送站内通知。
- `AI_LOCATION_TIME_ZONE`：管理统计的日历时区，默认 `Asia/Shanghai`。

## 多仓库配置

设置 `AI_LOCATION_REPOSITORIES_FILE` 指向仓库清单 JSON，格式见 `repositories.example.json`。清单最多支持 200 个仓库，包含 Agent 专用工作目录 `workdir`，及每个仓库的唯一 `id`、显示名称 `name`、类型 `kind`（`code` / `experience`）、目录 `root` 和 `enabled`。相对目录以 `workdir` 为基准，所有仓库及其目录链接须位于该目录内。该工作目录只放用于定位的代码和经验副本。

清单在服务启动时加载，修改后重启生效。未配置清单时兼容原有 `AI_LOCATION_CODE_ROOT` 和 `AI_LOCATION_KNOWLEDGE_ROOT`。服务按清单检索所有已启用仓库，每个仓库最多提供 5 条候选，最多并行 4 个检索；模型来源必须包含仓库 ID，多仓库下缺少归属的来源不展示。代码仓库与定位经验 / 文档分别管理，各自统计数量与不可访问数，清单支持搜索、状态筛选和每页 10 项。

CLI 使用同一清单配置，`repo-search` 检索已启用仓库，`repo-sync` 同步已启用的 Git 副本。仓库数量较多时，检索耗时和上下文用量会随数量增加；当前未实现按模块路由检索。

## 自动流程

问题创建或更新事务完成后，DTS 异步提交字段白名单内的问题快照（不发送 VPN 信息）。服务按内容指纹去重，按冷却时间合并待执行更新；任务排队后由有限并发 worker 执行。运行阶段和确定性检索进展会持续保存并在页面展示。真实 Agent 返回的代码/资料路径会校验文件及行号，无法核实的来源不展示。新建提问会按提出人或责任人定向发送站内通知。被提问人在问题详情回答后，服务保存回答并产生一次续跑任务。人员也可手动重新分析。服务重启后，运行中的任务回到队列，历史记录从持久文件恢复。

自动提交采用 DTS 后端的尽力投递。投递失败会记录后端日志，不影响问题创建；需要用下方 `backfill` 进行补录。此实现是单进程队列和单文件持久化，适合当前小规模试运行；多实例部署须改用共享数据库和持久队列。

## CLI：固定操作

```powershell
node cli.mjs status
node cli.mjs jobs
node cli.mjs settings
node cli.mjs set maxConcurrent 2
node cli.mjs set autoEnabled false
node cli.mjs retry <jobId>
node cli.mjs ingest <issue-snapshot.json>
node cli.mjs repo-search "RequestHandler"
node cli.mjs repo-sync
```

`repo-sync` 仅对显式配置的代码/知识 Git 工作副本执行 `fetch` + `merge --ff-only`，发现未提交修改时停止。`backfill` 使用项目负责人可访问问题列表的短期 DTS 令牌补录：设置 `AI_LOCATION_DTS_URL`（例如 `http://127.0.0.1:8080`）和 `AI_LOCATION_DTS_TOKEN_FILE`（仅包含令牌的本机文件）后运行 `node cli.mjs backfill`。CLI 经服务 API 操作，不直接修改状态文件。

## 管理面与接口

DTS「管理员页面 → AI 辅助定位」展示任务量、失败量、待补充、反馈和平均耗时，可修改自动运行、并发、排队上限、冷却、超时及单次提问上限。队列满时服务返回 429。DTS 依现有管理员令牌校验权限；浏览器不会得到服务密钥。问题详情的 AI 页签以红点提醒待补充信息，页签内展示进度、依据、对具体人员的提问、回答及历史。管理面可查询任务详情、负载统计与两类资料清单。

内部 HTTP 接口均需 `X-AI-Location-Key`：`POST /ai-location/issues`、`GET /ai-location/issues/:id`、`POST /ai-location/issues/:id/runs`、`POST /ai-location/questions/:id/answer`、`POST /ai-location/jobs/:id/feedback`，以及 `/ai-location/admin/*`。`GET /health` 无需密钥。

验证：定位服务 `npm test`、DTS 前端 `npm run build` 与对应组件 ESLint、后端 `mvn test`。Mock 端到端验证与真实 Chrys 模型调用是不同的验证范围。
