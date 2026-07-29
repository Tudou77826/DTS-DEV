# 工作交接说明 — JPA → MyBatis-Plus 迁移

> 交接日期：2026-07-29
> 仓库：https://github.com/Tudou77826/DTS-DEV （私有）
> 当前分支：main
> **JPA → MyBatis-Plus 迁移已完成。`mvn test` 通过，SQLite profile 已完成关键 API 回归；MySQL 运行环境尚未实机回归。**

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

回归测试脚本（41 项 API）原在 `backend/test-api.mjs`，但交接前已被我清理删除。接手人可参考下方"回归检查清单"手测，或让我（原作者）提供脚本。

---

## 四、回归检查清单（41 项，按顺序手测或脚本测）

账号：leader / wangwu / sunqi / submitter / admin，密码均为 `123456`

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

## 七、迁移完成后的功能增强路线（下一步做什么）

> 本节来源于对同事《需求分析 v2.0》+《软件设计 v1.0》两份文档的评审吸收。这些文档（GitHub Issue #1、#2）已阅后关闭。
> 评审结论：同事文档是"单版本轻量流转"导向，与本项目"多版本排查"定位不同，不能照搬。但其中有**当前代码缺、且确实有用**的增强点，整理如下。
> **前提已满足：JPA→MP 迁移（A~D）已经完成，可按本节优先级继续。**

### 建议落地清单

| 优先级 | 事项 | 工作量 | 说明 |
|--------|------|--------|------|
| **P0** | 流转权限矩阵 + 必填校验（防越权） | 小 | 当前任意登录人可流转任意状态。应改为：只有处理人能"解决"、只有提交人/管理员能"关闭/重新打开"。来源：设计文档 §4.1 状态机引擎（`ASSIGNEE_OR_ADMIN` / `CREATOR_OR_ADMIN` 校验） |
| **P0** | 附件上传/下载/删除 | 中 | 当前仅预留字段未实现。MVP 验收"附件、截图和日志"硬需求。来源：设计文档 §7.1 文件上传模块（`t_issue_attachment` 表，`source_type` 区分描述/评论附件） |
| **P0** | 问题编号改 `ISS-yyMMdd-NNN` | 小 | 当前是全年自增 `ISS-2026-0001`。改为按日期分段（`ISS-260729-001`），沟通引用清晰、并发冲突小。来源：需求文档 §2.2.2 + 设计文档 §4.2 |
| **P1** | 批量指派/关闭 + Excel 导出 | 中 | 项目负责人场景刚需。EasyExcel 依赖已在 pom。来源：需求文档 §2.4.2/2.4.3 |
| **P1** | 站内通知（轮询角标） | 中 | 当前完全没有通知。流转时写通知表，前端 60s 轮询未读数显示角标。来源：设计文档 §7.2（降级版，仅站内，不上邮件/IM） |
| **P2** | 问题关联/重复标记 | 中 | `IssueRelation` 表（related/duplicate）。多版本排查场景重复问题确实存在，但优先级低。来源：需求文档 §2.8 |
| **P2** | 富文本描述 + XSS 过滤 | 中（看需求） | 当前纯文本描述。是否上富文本取决于团队习惯：日志/堆栈/截图多则值得上（前端用 TipTap，非 WangEditor）；纯文字则维持现状。**XSS 过滤无论富文本与否后端都应做**。来源：设计文档 §4.4 |

### 落地建议顺序

1. **先 P0 三项**（权限矩阵 + 附件 + 编号）——价值最高、风险最低，且编号改造与迁移期间的 `IssueMapper.selectMaxCodeByPrefix` 已有铺垫
2. **再 P1 两项**（批量 + 导出 / 通知）——负责人提效
3. **最后 P2**（关联 / 富文本）——按实际需求取舍

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

接口文档：http://localhost:8080/api/swagger-ui.html

---

## 九、关键文件清单（接手人优先看这些）

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
