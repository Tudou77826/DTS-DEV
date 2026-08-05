# 开发人员问题管理平台 (DTS-DEV)

一个仿 Orca 风格（Linear / Vercel 派系，亮色优先 + 暗色可切换）的开发人员问题管理平台。核心闭环：

```
问题登记 → 分配开发人员 → 定位处理 → 多版本排查 → 记录原因 → 关闭问题
```

## 技术栈

| 层 | 技术 |
|----|------|
| 前端 | React 19 + TypeScript + Vite + **Tailwind CSS v4** + shadcn/ui（Orca 风格 token）+ TipTap 富文本 |
| 后端 | Spring Boot 3.3 + Java 21 + MyBatis-Plus + Spring Security + JWT + Flyway |
| 数据库 | MySQL 8（docker-compose 一键起）；本地开发可用 SQLite profile 零依赖跑通 |
| 其他 | EasyExcel（导出）、jsoup（XSS 过滤）、SpringDoc（接口文档）、Lombok |

## 认证方式（反向代理 OAuth）

生产环境对接统一认证：由网关（Nginx + OAuth 代理）完成登录后注入用户头（`X-Auth-User` 等），后端信任该头建立登录态。角色收敛为三级：

| 角色 | 说明 |
|------|------|
| `SUBMITTER` | 问题提出人（OAuth 用户首次登录自动建档，默认角色） |
| `DEVELOPER` | 开发人员，可被指定为责任人/协同人，处理问题 |
| `LEADER` | 项目负责人，可分配/转派、批量指派/关闭、查看团队负载 |

**接入定制管理**不再使用管理员账号：任何已登录用户进入「接入定制」页时输入**共享管理员密码**（默认 `admin123`，生产部署后请立即修改），通过后获得 30 分钟管理员令牌。

- 本地账号密码登录保留为**开发模式开关**（`app.auth.local.enabled`，生产默认关闭）。
- 网关必须**剥离外部伪造的 `X-Auth-*` 头**，否则任何人可冒充任意用户。
- 生产必须通过 `DTS_JWT_SECRET` 注入随机密钥（`openssl rand -hex 32`），并设置 `SPRINGDOC_ENABLED=false`。

## 目录结构

```
DTS-DEV/
├── docker-compose.yml        # MySQL
├── compose.production.yml    # 生产容器编排（SQLite + 前端静态托管）
├── deploy/                   # systemd / nginx 部署
├── backend/                  # Spring Boot 后端
│   └── src/main/java/com/dts/
│       ├── domain/           # 实体（MyBatis-Plus @TableName）
│       ├── mapper/           # MyBatis-Plus Mapper
│       ├── service/          # 业务逻辑 + 权限矩阵 + 内容清洗
│       ├── controller/       # REST API (/api 前缀)
│       ├── security/         # JWT / 头部认证 / 管理员令牌
│       ├── config/           # Security / CORS / 种子数据
│       ├── dto/              # 请求/响应 DTO
│       └── common/           # 统一响应、分页、异常
│   └── src/main/resources/
│       ├── dts-customization.yml      # 接入定制默认配置（含 admin.password-hash）
│       └── db/migration/              # Flyway（MySQL）/ migration-sqlite（SQLite）
└── frontend/                 # React 前端
    └── src/
        ├── components/ui/    # shadcn 组件（Orca 配色）
        ├── components/issue/ # 问题详情子组件
        ├── pages/            # 10 个核心页面
        ├── lib/              # API 封装 / 类型 / 标签映射
        └── store/            # zustand 状态
```

## 快速启动

### 1. 启动数据库（可选）

```bash
docker compose up -d        # 启动 MySQL
```

### 2. 启动后端

```bash
# 方式一：MySQL
cd backend && mvn spring-boot:run

# 方式二：SQLite（零依赖，推荐先验证迁移）
cd backend && mvn spring-boot:run -Dspring-boot.run.profiles=sqlite
```

- 首次启动会自动建表并写入种子数据（Flyway + DataInitializer）。
- 接口文档：http://localhost:8080/api/swagger-ui.html

### 3. 启动前端

```bash
cd frontend
npm install                 # 首次
npm run dev                 # 启动于 http://localhost:5173
```

前端已配置代理，`/api` 请求自动转发到 `localhost:8080`。

## 演示账号（开发模式，密码均为 `123456`）

| 账号 | 角色 | 说明 |
|------|------|------|
| `leader` | 项目负责人 | 分配问题、批量指派/关闭、查看团队负载 |
| `wangwu` / `zhaoliu` / `sunqi` | 开发人员 | 接收任务、记录进展、流转状态 |
| 任意 OAuth 首次登录用户 | 问题提出人 | 自动建档，提交/查看问题 |

> 管理员入口不在此列：进入「接入定制」页输入共享管理员密码（默认 `admin123`）。

## 核心功能与对应页面

| 功能 | 页面 | 路由 |
|------|------|------|
| 问题登记/编辑 | 新建/编辑问题 | `/issues/new`、`/issues/:id/edit` |
| 问题列表与筛选 | 问题列表（关键字/状态/模块/产品/领域/责任人/提出人/时间/超期/排查版本） | `/issues` |
| 问题详情（含时间线） | 问题详情 | `/issues/:id` |
| 开发任务分配 | 详情页「分配/调整」+ 协同人 + 我的任务 | `/my-tasks` |
| 问题状态管理 | 详情页「流转状态」（关闭/重开仅提出人） | 状态机驱动 |
| 多版本排查 | 详情页「版本排查」Tab + 版本排查页 | `/investigations` |
| 进展与处理记录 | 详情页「处理记录」Tab | 时间线 |
| 评论与协同（@提及 + 附件） | 详情页「评论」Tab | — |
| 附件上传/下载/删除 | 详情页「附件」Tab（仅上传者可删） | — |
| 问题关联/重复标记 | 详情页「关联」Tab | — |
| 批量指派/关闭（LEADER） | 问题列表多选 | — |
| Excel 导出 | 问题列表 | — |
| 工作台 | 开发/负责人工作台 | `/dashboard` |
| 统计看板 | 统计概览 | `/stats` |
| 基础配置 | 产品/版本/模块/领域/团队 CRUD | `/config` |
| 接入定制 | 品牌/术语/流程/人员/开关（管理员密码门禁） | `/customization` |
| 站内通知 | 侧栏通知中心（60s 轮询） | — |

## 状态流转图

```
待分配 ──分配──▶ 待定位 ──开始定位──▶ 定位中 ──提交验证──▶ 待验证 ──验证通过──▶ 已解决 ──关闭──▶ 已关闭
                    │                    │                  │                   │
                    └─待补充信息◀────────┘                  └─重新打开──────────▶重新打开
                                         ├─无法复现 / 暂缓 / 无须处理
```

## 关键 API（均在 `/api` 前缀下，需 Bearer Token）

- `POST /auth/login`、`GET /auth/me`、`GET /auth/mode` 认证
- `GET/POST /issues`、`PUT /issues/{id}`、`GET /issues/{id}` 问题
- `POST /issues/{id}/assign`、`POST /issues/{id}/status`、`POST /issues/{id}/progress`
- `POST /issues/{id}/comments`、`GET /issues/{id}/operations`
- `POST /issues/batch/assign`、`POST /issues/batch/close`、`GET /issues/export`
- `GET/POST /issues/{id}/attachments`、`GET/DELETE /attachments/{id}` 附件
- `GET/POST /issues/{id}/relations` 关联
- `GET/POST /investigations`、`POST /investigations/generate` 版本排查
- `GET /stats/overview`、`GET /stats/version-remain` 统计
- `GET /config/dictionaries` 字典；`POST /config/customization/admin/verify` 管理员门禁

## 开发说明

- 主题切换：登录后点击左下角头像 → 切换亮/暗色。默认亮色。
- 数据库表结构由 Flyway 迁移管理（`db/migration` 与 `db/migration-sqlite` 两套，改表两边都要改）。
- 接入定制配置为外部 YAML（`backend/config/dts-customization.yml`），修改后需重启生效；管理员密码可经定制页在线修改。
- 后端日志级别 DEBUG，SQL 会打印。
