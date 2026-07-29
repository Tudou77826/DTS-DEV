# 开发人员问题管理平台 (DTS-DEV)

一个仿 Orca 风格（Linear / Vercel 派系，亮色优先 + 暗色可切换）的开发人员问题管理平台。核心闭环：

```
问题登记 → 分配开发人员 → 定位处理 → 多版本排查 → 记录原因 → 关闭问题
```

## 技术栈

| 层 | 技术 |
|----|------|
| 前端 | React 19 + TypeScript + Vite + **Tailwind CSS v4** + shadcn/ui（Orca 风格 token） |
| 后端 | Spring Boot 3.3 + Java 21 + Spring Data JPA + Spring Security + JWT |
| 数据库 | MySQL 8 + Redis 7（docker-compose 一键起） |
| 其他 | EasyExcel（Excel 导入预留）、SpringDoc（接口文档）、Lombok |

## 目录结构

```
DTS-DEV/
├── docker-compose.yml        # MySQL + Redis
├── backend/                  # Spring Boot 后端
│   └── src/main/java/com/dts/
│       ├── domain/           # 实体 + 状态机常量
│       ├── repository/       # JPA Repository
│       ├── service/          # 业务逻辑
│       ├── controller/       # REST API (/api 前缀)
│       ├── security/         # JWT + 登录用户
│       ├── config/           # Security / CORS / 种子数据
│       ├── dto/              # 请求/响应 DTO
│       └── common/           # 统一响应、分页、异常
└── frontend/                 # React 前端
    └── src/
        ├── components/ui/    # shadcn 组件（Orca 配色）
        ├── components/issue/ # 问题详情子组件
        ├── pages/            # 9 个核心页面
        ├── lib/              # API 封装 / 类型 / 标签映射
        └── store/            # zustand 状态
```

## 快速启动

### 1. 启动数据库

```bash
docker compose up -d        # 启动 MySQL + Redis
```

### 2. 启动后端

```bash
cd backend
mvn spring-boot:run         # 启动于 http://localhost:8080/api
```

- 首次启动会自动建表并写入种子数据（6 个用户、2 产品、4 模块、4 版本、5 领域）。
- 接口文档：http://localhost:8080/api/swagger-ui.html

### 3. 启动前端

```bash
cd frontend
npm install                 # 首次
npm run dev                 # 启动于 http://localhost:5173
```

前端已配置代理，`/api` 请求自动转发到 `localhost:8080`。

## 演示账号（密码均为 `123456`）

| 账号 | 角色 | 说明 |
|------|------|------|
| `admin` | 管理员 | 全部权限 |
| `leader` | 项目负责人 | 分配问题、查看团队负载 |
| `wangwu` / `zhaoliu` / `sunqi` | 开发人员 | 接收任务、记录进展 |
| `submitter` | 问题提出人 | 提交问题 |

## 核心功能与对应页面

| MVP 功能 | 页面 | 路由 |
|---------|------|------|
| 问题登记 | 新建问题 | `/issues/new` |
| 问题列表与查询 | 问题列表 | `/issues` |
| 问题详情（含时间线） | 问题详情 | `/issues/:id` |
| 开发任务分配 | 详情页「分配」 + 我的任务 | `/my-tasks` |
| 问题状态管理 | 详情页「流转状态」 | 状态机驱动 |
| 多版本排查 | 详情页「版本排查」Tab + 版本排查页 | `/investigations` |
| 进展与处理记录 | 详情页「处理记录」Tab | 时间线 |
| 评论与协同 | 详情页「评论」Tab | — |
| 工作台 | 开发/负责人工作台 | `/dashboard` |
| 基础统计 | 统计看板 | `/stats` |
| 基础配置 | 基础配置 | `/config` |

## 状态流转图

```
待分配 ──分配──▶ 待定位 ──开始定位──▶ 定位中 ──提交验证──▶ 待验证 ──验证通过──▶ 已解决 ──关闭──▶ 已关闭
                    │                    │                  │                   │
                    └─待补充信息◀────────┘                  └─重新打开──────────▶重新打开
                                         ├─无法复现 / 暂缓 / 无须处理
```

## 关键 API（均在 `/api` 前缀下，需 Bearer Token）

- `POST /auth/login` 登录
- `GET/POST /issues` 问题列表/创建
- `GET /issues/{id}` 详情
- `POST /issues/{id}/assign` 分配
- `POST /issues/{id}/status` 状态变更
- `POST /issues/{id}/progress` 添加进展
- `POST /issues/{id}/comments` 评论
- `GET /issues/{id}/operations` 操作时间线
- `GET/POST /investigations` 版本排查
- `POST /investigations/generate` 按版本生成排查清单
- `GET /stats/overview` 统计概览
- `GET /config/dictionaries` 全部字典

## 开发说明

- 主题切换：登录后点击左下角头像 → 切换亮/暗色。默认亮色。
- 数据库表由 JPA `ddl-auto: update` 自动维护。
- 后端日志级别 DEBUG，SQL 会打印。
