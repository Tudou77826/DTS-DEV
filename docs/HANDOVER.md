# 工作交接说明 — JPA → MyBatis-Plus 迁移

> 交接日期：2026-07-29（更新：2026-08-05）
> 仓库：https://github.com/Tudou77826/DTS-DEV （私有）
> 当前分支：main
> **JPA → MyBatis-Plus 迁移已完成；第七节 P0/P1/P2 全部增强项已实现并回归；OAuth 反向代理认证 + 管理员密码门禁已合入。`mvn test`（23 用例）通过。**

---

## 一、项目背景（必读）

这是一个"开发人员问题管理平台" MVP，前后端全栈：

- **后端**：Spring Boot 3.3 + Java 21，原 ORM 用 Spring Data JPA
- **前端**：React 19 + TypeScript + Vite + Tailwind v4 + shadcn/ui（仿 Orca 风格，亮色优先）
- **数据库**：MySQL 8（docker-compose）+ Redis；另提供 SQLite profile 用于零依赖本地验证

前端已完成并验证，**本次交接的任务是把后端 ORM 从 JPA 迁移到 MyBatis-Plus**，前端完全不受影响。

迁移原因：团队主力熟悉 MyBatis。代价是失去 JPA 的自动建表（已用 Flyway 补偿）。

---

## 二、迁移进度（核心！请先看这个）

### ✅ 已完成

| # | 内容 | 文件位置 |
|---|------|---------|
| 1 | pom 依赖：去掉 JPA starter，加 mybatis-plus-spring-boot3-starter 3.5.9 + Flyway | `backend/pom.xml` |
| 2 | 11 个实体去掉 JPA 注解（`@Entity`/`@Table`/`@Column`），改 MyBatis-Plus `@TableName` | `backend/src/main/java/com/dts/domain/*.java` |
| 3 | BaseEntity 改 `@TableId(AUTO)` + `@TableField(fill=...)` | `domain/BaseEntity.java` |
| 4 | application.yml：去掉 `spring.jpa`，加 `mybatis-plus` + `spring.flyway` | `backend/src/main/resources/application.yml` |
| 5 | application-sqlite.yml：同步改为 MP + Flyway | `application-sqlite.yml` |
| 6 | Flyway 建表脚本（MySQL 版 + SQLite 版） | `resources/db/migration/V1__init.sql`、`resources/db/migration-sqlite/V1__init.sql` |
| 7 | MybatisPlusConfig：分页插件 + MetaObjectHandler（审计字段自动填充，替代 JPA 的 @CreatedDate） | `config/MybatisPlusConfig.java` |
| 8 | 11 个 Mapper（替代原 Repository）全部继承 BaseMapper | `mapper/*.java` |
| 9 | IssueMapper 的自定义查询（投影聚合、编号生成、超期查询）用 `@Select` 注解实现 | `mapper/IssueMapper.java` |
| 10 | 删除旧的 JpaConfig、repository 包 | 已删除 |
| 11 | DtsApplication 加 `@MapperScan("com.dts.mapper")` | `DtsApplication.java` |

### ✅ 完成与验证结果

| # | 内容 | 结果 |
|---|------|------|
| **A** | **Service 层改造** | 6 个 Service 和 `DataInitializer` 已全部改用 Mapper，源码无 JPA/Repository 残留 |
| **B** | **PageResult 适配** | 已改用 `IPage<T>`，Controller 返回结构保持不变 |
| **C** | **编译与测试** | `cd backend && mvn test` 通过 |
| **D** | **SQLite 运行回归** | 已验证启动、种子数据、登录、分页筛选、创建/分配/状态流转、进展、评论、操作日志、统计和版本排查 |

---

## 三、迁移实现说明（维护参考）

### A. Service 层改造（最重要）

6 个 Service 文件已改为直接注入 MyBatis-Plus Mapper：

**已改文件**（都在 `backend/src/main/java/com/dts/service/`）：
- `IssueService.java` —— 最复杂，工作量占 60%
- `StatsService.java`
- `InvestigationService.java`
- `ConfigService.java`
- `LookupService.java`
- `AuthService.java`

#### 改造要点对照表

| JPA 写法（现在） | MyBatis-Plus 写法（改成） |
|------------------|--------------------------|
| `JpaRepository<T, Long>` 注入 | `BaseMapper<T>` 注入（或 `IService`+`ServiceImpl`，本项目建议直接用 Mapper，改动小） |
| `repo.save(entity)` | `mapper.insert(entity)` / `mapper.updateById(entity)` |
| `repo.findById(id)` | `mapper.selectById(id)` |
| `repo.findAll()` | `mapper.selectList(null)` |
| `repo.existsById(id)` | `mapper.selectById(id) != null` 或 `mapper.selectCount(...)` |
| `repo.delete(entity)` / `deleteById(id)` | `mapper.deleteById(id)` |
| `repo.findAllById(ids)` | `mapper.selectBatchIds(ids)` |
| `repo.findByXxx(...)` 派生查询 | `mapper.selectList(new LambdaQueryWrapper<T>().eq(...))` |
| `Pageable` + `repo.findAll(spec, pageable)` | `mapper.selectPage(new Page<>(page, size), queryWrapper)` |
| `Specification` 动态条件 | `LambdaQueryWrapper<T>` 链式条件（`.eq(condition, field, val)`） |
| `Page<T>` 返回 | `IPage<T>`（`getList()`/`getTotal()`/`getCurrent()`/`getSize()`/`getPages()`） |
| `@Query` 投影接口 | 已用 `@Select` 注解搬到 IssueMapper，返回 `List<StatBucket>`（见 `dto/StatBucket.java`） |

#### IssueService 改造重点（最大头）

这个文件原有两个 `Specification` 动态查询，现已改成 `LambdaQueryWrapper`：

**1. `page(IssueQuery q)` 方法**（问题列表多维筛选）

原 JPA `Specification` 构造的 8 个条件（keyword/moduleId/productId/domainId/status/submitterId/assigneeId/foundVersionId/createdFrom/createdTo），改写为：

```java
LambdaQueryWrapper<Issue> w = new LambdaQueryWrapper<>();
if (keyword 不空) {
    w.and(k -> k.like(Issue::getCode, kw)
               .or().like(Issue::getDescription, kw)
               .or().like(Issue::getSearchKeywords, kw));
}
w.eq(q.getModuleId() != null, Issue::getModuleId, q.getModuleId());
w.eq(q.getProductId() != null, Issue::getProductId, q.getProductId());
// ... 其余条件同理
w.ge(q.getCreatedFrom() != null, Issue::getCreatedAt, q.getCreatedFrom());
w.le(q.getCreatedTo() != null, Issue::getCreatedAt, q.getCreatedTo());
w.orderByDesc(Issue::getCreatedAt);

IPage<Issue> page = issueMapper.selectPage(new Page<>(page, size), w);
```

**2. `myTasks(String tab)` 方法**（我的任务）—— 同理改成 `LambdaQueryWrapper`，含 `or(assigneeId = me OR collaboratorIds like %me%)` + 按 tab 选状态集合的 `in()` 条件。overdue tab 加 `lt(planFinishAt, now)`。

**3. 统计相关** —— `count()`、`countByXxx` 这些原来用 JPA 派生方法，MP 里改成：
- `mapper.selectCount(queryWrapper)`
- 聚合用已写好的 `issueMapper.countByStatusGrouped()` / `countByModuleGrouped()` / `countPendingByAssignee()`（返回 `List<StatBucket>`）

**4. 编号生成 `generateCode()`** —— 原来用 `repo.count()+1`，现用 `issueMapper.selectMaxCodeByPrefix(prefix)` 取当年最大序号 +1。

#### LookupService 改造

原用 `findAllById` + `Collectors.toMap`。改成 `mapper.selectBatchIds(ids)` + `Collectors.toMap`。逻辑不变，只换调用方式。

**注意**：`Collectors.toMap` 的 value 不能为 null，模块名/产品名理论上都非空，没问题。

#### StatsService 改造

原调用 IssueRepository 的投影接口方法（`countByStatusGrouped()` 等返回 `StatusCount`/`BucketCount`）。现在改成调用 `issueMapper` 的同名方法，返回 `List<StatBucket>`（`getBucket()` 是 String，`getCnt()` 是 Long）。`versionRemainCount()` 原来遍历 `investigationRepository.findAll()`，改成 `versionInvestigationMapper.selectList(null)`。

### B. PageResult 适配

`common/PageResult.java` 的 `of(Page<T> page)` 方法签名是基于 Spring Data 的 `Page<T>`。需要增加/改写一个接收 MP `IPage<T>` 的重载：

```java
public static <T> PageResult<T> of(IPage<T> page) {
    return new PageResult<>(
        page.getRecords(),
        page.getTotal(),
        (int) page.getCurrent(),
        (int) page.getSize(),
        (int) page.getPages());
}
public static <T, R> PageResult<R> of(IPage<T> page, List<R> mapped) {
    return new PageResult<>(mapped, page.getTotal(), (int)page.getCurrent(), (int)page.getSize(), (int)page.getPages());
}
```

Controller 层（返回 `ApiResponse<PageResult<IssueVo>>`）**不用改**，因为 DTO 结构没变。

### C. 编译验证

```bash
cd backend
mvn compile
```
当前可通过。源码中已无 `org.springframework.data.*`、`jakarta.persistence.*` 或旧 Repository 引用。

### D. 运行回归（用 SQLite，零依赖）

```bash
cd backend
mvn spring-boot:run -Dspring-boot.run.profiles=sqlite
# 启动于 http://localhost:8080/api
```
前端：
```bash
cd frontend
npm install   # 已装过可跳过
npm run dev
```

黑盒回归脚本在 `backend/regress.mjs`（需先启动服务）：覆盖核心闭环、权限矩阵、编号格式、附件上传/下载/删除、通知已读、批量指派/关闭、Excel 导出、问题关联、XSS 过滤。下方清单为对应手测参考。

---

## 四、回归检查清单（41 项，按顺序手测或脚本测）

账号（本地开发模式）：leader / wangwu / sunqi，密码均为 `123456`
接入定制管理：输入共享管理员密码 `admin123`（生产部署后请通过定制页修改）

> 认证方式已切换为「反向代理 OAuth + 代理头注入」，本地账号密码登录仅作为开发模式开关（`app.auth.local.enabled`）。
> 接入定制不再依赖 ADMIN 账号，改为共享管理员密码门禁（默认 `admin123`，BCrypt 存于配置 `admin.password-hash`）。
> 普通问题提出人由统一认证首次登录时自动建档，无需在接入配置中维护。

1. 登录返回 token + 用户信息正确
2. 错误密码 → 401
3. 字典接口：产品2/版本4/模块4/开发3
4. 创建问题：编号 ISS-、状态待分配、提交人自动填充
5. 分配责任人：状态→待定位、责任人名称解析
6. 状态全链路：待定位→定位中→待验证→已解决→已关闭
7. resolvedAt/closedAt 自动记录
8. 定位时长计算
9. 进展记录 + 根因同步回问题
10. 操作时间线（每次流转留痕，≥5条）
11. 版本排查记录（创建/查询）
12. 评论（创建/列表）
13. 列表查询（按状态/关键字搜索/分页）
14. 统计概览（状态分布）
15. 按版本生成排查清单（跳过已关闭）
16. 重新打开（closedAt 清空）
17. 无 token → 401
18. 我的任务（开发人员视角）

---

## 五、迁移前后对照速查（架构层）

```
迁移前（JPA）                      迁移后（MyBatis-Plus）
─────────────────                  ──────────────────────
domain/ @Entity/@Table/@Column  →  @TableName（去掉@Column）
repository/ XxxRepository       →  mapper/ XxxMapper extends BaseMapper
  extends JpaRepository                （派生查询→LambdaQueryWrapper）
  + JpaSpecificationExecutor
config/JpaConfig @EnableJpaAuditing → config/MybatisPlusConfig
                                       分页插件+MetaObjectHandler
ddl-auto: update 自动建表       →  Flyway db/migration/V1__init.sql
Specification 动态查询          →  LambdaQueryWrapper
Page<T>/Pageable                →  IPage<T>/Page<T>
@Query 投影接口                 →  IssueMapper @Select 注解 + StatBucket DTO
```

---

## 六、已知坑 / 注意事项

1. **Flyway 在已存在库的行为**：配了 `baseline-on-migrate: true`，对已有数据的库首次跑会建 baseline，不会丢数据。但建议接手后第一次跑用**全新空库**验证建表脚本正确性。

2. **SQLite 与 MySQL 的 SQL 差异**：`IssueMapper` 的聚合查询直接返回 ID 列，由 MyBatis 映射为字符串；编号查询由 Java 传入带 `%` 的 `LIKE` 参数，避免依赖两端不同的字符串拼接或类型转换语法。新增自定义 SQL 时仍需在两个数据库上验证。

3. **两个 Flyway 目录**：`db/migration`（MySQL）和 `db/migration-sqlite`（SQLite），由不同 profile 的 `spring.flyway.locations` 区分。改表结构时**两边都要改**。

4. **审计字段填充**：`MetaObjectHandler` 用 `strictInsertFill`/`strictUpdateFill`，要求实体字段必须标 `@TableField(fill=FieldFill.INSERT)`，BaseEntity 已配好。新增实体继承 BaseEntity 即可，不要再自己写时间字段。

5. **LogicDelete 未启用**：当前没有逻辑删除。如果以后要，在 yml 配 `logic-delete-field` + 实体加 `@TableLogic`。

6. **前端零影响**：迁移只动后端，前端 API 契约（URL、请求体、响应体 `{code,message,data}`）保持不变，前端代码不用动。

---

## 七、功能增强路线（原 P0/P1/P2 — 已全部落地）

> 本节来源于对同事《需求分析 v2.0》+《软件设计 v1.0》两份文档的评审吸收。
> **状态：全部完成（2026-08-05 已实现并回归），接手人不要再重复实施。**

| 优先级 | 事项 | 状态 | 实现位置 |
|--------|------|------|----------|
| **P0** | 流转权限矩阵 + 必填校验（防越权） | ✅ 完成 | `service/IssuePermissionService.java`：关闭/重开仅提交人、其他流转仅当前责任人、必填根因/结论 |
| **P0** | 附件上传/下载/删除 | ✅ 完成 | `controller/AttachmentController.java` + `service/AttachmentService.java`，`issue_attachment` 表，`source_type` 区分 ISSUE/COMMENT |
| **P0** | 问题编号改 `ISS-yyMMdd-NNN` | ✅ 完成 | `IssueService.generateCode()`，规则可配（`issue.code`），唯一索引冲突自动重试取号 |
| **P1** | 批量指派/关闭 + Excel 导出 | ✅ 完成 | `POST /issues/batch/assign`、`POST /issues/batch/close`（负责人专属）、`GET /issues/export`（EasyExcel） |
| **P1** | 站内通知（轮询角标） | ✅ 完成 | `notification` 表 + `NotificationController`，前端 60s 轮询 |
| **P2** | 问题关联/重复标记 | ✅ 完成 | `issue_relation` 表 + `IssueRelationController` + 前端「关联」Tab |
| **P2** | 富文本描述 + XSS 过滤 | ✅ 完成 | 前端 TipTap + 后端 jsoup `ContentSanitizer`（富文本白名单），`rich-text` 开关前后端均已生效 |

**后续已额外落地（非原规划）：OAuth 反向代理认证（头部信任 + 首次登录自动建档）、角色收敛为 SUBMITTER/DEVELOPER/LEADER、共享管理员密码门禁（30 分钟短时令牌）、问题编辑/评论 @提及/协同人/列表高级筛选等前端补齐。**

### 落地后仍建议关注（低优先）

- 通知列表固定 50 条无分页；`versionRemainCount` 为全表内存聚合（数据量大时优化为 SQL）。
- `PUT /issues/{id}` 编辑接口无操作日志留痕（新增编辑日志需在 update 中补 logOperation）。
- 单测目前覆盖权限矩阵/编号重试/清洗/门禁（23 用例），Service 其余分支尚无测试。

### 同设计文档但明确"拒绝/不采纳"的项（避免接手人误改）

- ❌ **前端切 Vue + Element Plus + WangEditor** —— 已定 React + Orca 风格并实现，切换是推倒重来
- ❌ **状态机精简到 4 状态** —— 本项目需多版本排查/定位中/待验证/待补充信息等多状态，保留现状
- ❌ **module 用文本字段、去掉模块表** —— 本项目有"各模块问题数量"统计，需模块实体
- 技术栈分歧（JPA vs MyBatis-Plus）—— 已通过本次迁移闭环

---

## 八、本地启动方式（接手人快速跑起来）

```bash
# 方式一：MySQL（需要先起 docker）
docker compose up -d
cd backend && mvn spring-boot:run

# 方式二：SQLite（零依赖，推荐先验证迁移）
cd backend && mvn spring-boot:run -Dspring-boot.run.profiles=sqlite

# 前端
cd frontend && npm run dev
# 访问 http://localhost:5173（若端口被占会自动换，看日志）
```

本地开发默认关闭代理头认证、开启本地账号密码登录：`app.oauth.header.enabled=false`、`app.auth.local.enabled=true`
（`backend/src/main/resources/application-sqlite.yml` 已配置）。账号 leader / wangwu / sunqi，密码 `123456`。

接口文档：http://localhost:8080/api/swagger-ui.html

---

## 九、认证架构（OAuth 对接改造）

### 9.1 目标模式（生产）

- 外层由**反向代理 / OAuth 认证网关**（如 oauth2-proxy、Keycloak 网关）完成统一认证。
- 网关认证通过后向后端注入用户身份头，并**剥离客户端伪造的同名头**：
  - `X-Auth-User`（必填，登录名）→ `app.oauth.header.username-header`
  - `X-Auth-Display-Name`、`X-Auth-Email`、`X-Auth-Employee-No`（可选）
- 后端 `security/HeaderAuthFilter.java` 信任这些头建立登录态：
  - 已存在的用户：按运行库中的角色构建登录态（角色由接入配置/建档维护）；
  - **首次登录自动建档**为普通提出人（`SUBMITTER`，无密码），后续可在接入配置中升级为负责人/开发人员；
  - 停用的账号（`active=false`）拒绝访问。
- 生产配置：`DTS_OAUTH_HEADER_ENABLED=true`、`DTS_AUTH_LOCAL_ENABLED=false`。

### 9.2 本地开发模式

`app.auth.local.enabled=true` 时保留原有用户名+密码登录（JWT 签发），用于无 IdP 时的本地联调。
本地登录与代理头认证互斥启用（启用代理头后，后端以代理头为准）。

### 9.3 角色收敛

| 角色 | 来源 | 权限 |
| --- | --- | --- |
| `SUBMITTER` | 统一认证首次登录自动建档 | 提问题、看问题、关闭/重新打开自己提交的问题 |
| `DEVELOPER` | 接入配置 `master-data.users` | 可被指定为责任人、处理/流转问题 |
| `LEADER` | 接入配置 `master-data.users` | 分配责任人、批量指派、负责人工作台 |

原 `ADMIN` 角色已移除，**不再作为用户角色**。接入定制管理改为「共享管理员密码门禁」：

- 密码以 BCrypt 哈希存于配置 `admin.password-hash`（默认 `admin123`，生产需立即修改）。
- 任何已登录用户进入「接入定制」页时输入密码，验证通过后由 `AdminAccessService` 签发**短时管理员令牌**（默认 30 分钟，`app.admin-token.expiration-ms`）。
- `AdminTokenFilter` 解析 `X-Admin-Token` 头并追加 `ROLE_ADMIN` 权限，放行 `ConfigController` 中 `@PreAuthorize("hasRole('ADMIN')")` 的管理接口。
- 管理接口无普通权限，仅持有短时管理员令牌才可访问。

### 9.4 关键文件

```
backend/src/main/java/com/dts/
├── security/
│   ├── HeaderAuthFilter.java      # 代理头认证 + 首次登录自动建档
│   ├── AdminTokenFilter.java      # 管理员令牌 → 追加 ROLE_ADMIN
│   ├── JwtAuthFilter.java         # 本地登录 JWT（开发模式）
│   └── LoginUser.java             # isLeader() 仅 LEADER；含 avatarColor
├── config/
│   ├── AppAuthProperties.java     # app.auth.local / app.oauth.header
│   ├── SecurityConfig.java        # 过滤器链：JWT → 代理头 → 管理员令牌
│   └── DataInitializer.java       # 配置仅同步 DEVELOPER/LEADER，普通提出人自动建档
├── service/
│   ├── AdminAccessService.java    # 管理员密码校验 / 修改
│   └── IssuePermissionService.java# 关闭/重开仅提交人，流转仅责任人（无管理员例外）
└── controller/ConfigController.java # /config/customization/admin/verify + /password
frontend/src/
├── store/auth.ts                  # mode(local/oauth) + 管理员会话
├── lib/api.ts                     # X-Admin-Token 注入 + 管理员会话失效处理
└── pages/customization.tsx        # 管理员密码门禁页
```

数据库迁移 `V6__oauth_provision.sql`（MySQL 与 SQLite）：`sys_user.password` 允许为空（自动建档用户无本地密码）。

---

## 十、关键文件清单（接手人优先看这些）

```
backend/
├── pom.xml                                    # ✅ 依赖已改好
├── src/main/java/com/dts/
│   ├── DtsApplication.java                    # ✅ @MapperScan 已加
│   ├── config/
│   │   ├── MybatisPlusConfig.java             # ✅ 分页+审计
│   │   ├── SecurityConfig.java                # 未动（无需改）
│   │   └── DataInitializer.java               # ✅ 启动种子数据，已改用 Mapper
│   ├── domain/*.java                          # ✅ 11个实体已转换
│   ├── mapper/*.java                          # ✅ 11个Mapper已建
│   ├── dto/StatBucket.java                    # ✅ 新增投影DTO
│   ├── common/PageResult.java                 # ⛔ 需加 IPage 重载
│   └── service/*.java                         # ✅ 6个 Service 已改用 Mapper
└── src/main/resources/
    ├── application.yml                        # ✅ MP+Flyway 配好
    ├── application-sqlite.yml                 # ✅ 配好
    └── db/
        ├── migration/V1__init.sql             # ✅ MySQL建表
        └── migration-sqlite/V1__init.sql      # ✅ SQLite建表
```

`DataInitializer.java` 已改为注入 Mapper，并通过 `insert()` 写入种子数据；SQLite 空库启动已验证可正常生成 6 个用户、2 个产品、4 个模块、4 个版本和 5 个领域。

---

*交接说明结束。有问题可联系原作者（本次会话）。*
