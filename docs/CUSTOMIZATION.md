# DTS 接入定制配置

## 目标

`dts-customization.yml` 是 DTS 对接不同团队或外部系统时的统一适配入口。配置范围按系统能力组织，不从单个页面或控件出发。

内部代码使用稳定的技术值，例如 `DEVELOPER`、`PENDING_VERIFY` 和 `URGENT`。接入配置负责定义这些技术值在目标团队中的展示名称、可用流程和初始主数据。新增技术值仍需要代码支持，不能仅靠修改配置扩展领域模型。

## 配置来源

系统按以下顺序加载配置，后加载项覆盖先加载项：

1. JAR 内置的 `classpath:dts-customization.yml`
2. 运行目录下的 `./config/dts-customization.yml`

本地开发的默认配置位于：

`backend/src/main/resources/dts-customization.yml`

生产部署应使用外部配置文件，避免修改或重新打包 JAR。修改配置后需要重启后端。

## 管理页面

管理员可从侧边栏进入“接入定制”页面。默认使用结构化表单维护配置：

- 接口仅允许 `ADMIN` 角色访问。
- 品牌、术语、编号、优先级、字段、流转、主数据和功能开关分别维护。
- 状态流转通过可点击的状态关系配置，不要求管理员编写 YAML。
- YAML 编辑器仅放在“高级模式”，用于适配器扩展和问题排查。
- 保存前校验 YAML 语法、编号规则、优先级默认值、状态定义和流转引用。
- 首次保存会创建外部配置文件；后续保存会先生成带时间戳的备份。
- 文件通过临时文件原子替换，避免写入中断产生半份配置。
- 保存后明确标记“等待重启”，不会在运行实例中局部热更新。

页面适合受控维护，不替代版本管理。生产配置仍应纳入部署审批和变更审计。

## 配置边界

| 配置段 | 用途 |
| --- | --- |
| `profile` | 标识当前适配目标、团队和外部系统 |
| `branding` | 系统名称、登录文案、主题色和演示信息 |
| `terminology` | 团队使用的业务术语 |
| `roles` | 稳定角色代码对应的展示名称 |
| `issue.code` | 问题编号前缀、日期格式和流水位数 |
| `issue.priorities` | 优先级代码、名称和颜色语义 |
| `issue.statuses` | 状态代码、名称和颜色语义 |
| `issue.transitions` | 允许的状态流转矩阵 |
| `issue.fields` | 表单字段名称、提示、显示和必填信息 |
| `master-data` | 产品、模块、版本和领域等初始主数据 |
| `features` | 可按接入目标关闭的独立功能 |
| `extensions` | 由特定适配器读取、DTS 核心不解释的扩展参数 |

## 主数据同步

默认同步模式为 `merge`：

- 配置中新增的产品、模块、版本和领域会写入数据库。
- 同名产品的描述会按配置更新。
- 管理员在基础配置页面维护的其他数据不会被删除。

配置文件适合维护接入基线，基础配置页面适合维护运行期数据。需要由外部系统完全托管主数据时，应实现对应适配器，并将连接参数放入 `extensions`，不应把接口凭据写入前端配置。

## 外部系统示例

```yaml
dts:
  customization:
    profile:
      id: team-a-alm
      name: Team A ALM 接入
      target-team: Team A
      target-system: ALM
    branding:
      product-name: Team A 缺陷协同平台
      show-demo-accounts: false
    terminology:
      issue: 缺陷
      assignee: 经办人
    issue:
      code:
        prefix: BUG
        date-pattern: yyyyMMdd
        sequence-digits: 4
    extensions:
      alm:
        project-key: TEAM-A
        endpoint: ${ALM_ENDPOINT}
```

密钥、令牌和密码应通过环境变量或密钥管理系统注入，不应提交到配置文件。
