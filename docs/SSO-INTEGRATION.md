# SSO 接入指南（W3 / W3X 统一身份源）

本系统已内置 SSO（公司统一身份源 W3/W3X）接入骨架。**内网部署方接手时，通常只需改配置 + 一处接缝代码即可跑通。** 本文档说明数据流、接缝位置与对接清单。

## 一、认证模型概览

系统支持两种互斥的认证模式，由配置开关决定：

| 模式 | 开关 | 适用场景 | 身份来源 |
|------|------|----------|----------|
| `local` | `app.auth.local.enabled=true` | 开发 / 非内网环境兜底 | 本地账号密码（`sys_user` + BCrypt） |
| `sso` | `app.sso.enabled=true` | 内网生产 | W3 登录 → W3X 取用户信息 → 应用签发 JWT |

两种模式登录成功后，**统一签发本系统 JWT，前端统一用 `X-Auth-Token` 请求头携带**。后端 `JwtAuthFilter` 识别此头建立登录态。

> 开关关系：`/auth/mode` 返回的 `mode` 字段 = `sso.enabled ? "sso" : "local"`。生产建议 `sso.enabled=true` 且 `auth.local.enabled=false`（互斥）；若两者都开，前端按 `mode` 渲染对应入口。

## 二、数据流（跨域主流程）

这是内网部署的典型场景——**前端域名与 W3 不同域，浏览器 JS 读不到 W3 的 cookie**，必须由 W3 把凭证回带到前端 URL。

```
① 用户访问应用 → 前端拉 /auth/mode 发现 mode=sso，无 token → 跳 /login
② /login 显示「前往统一认证登录」按钮 → 点击 → redirectToSsoLogin()
③ 浏览器跳转 W3 登录页：
   {W3登录页}?{redirect-param}={前端 origin}/auth/callback
④ 用户在 W3 登录成功 → W3 回跳：
   {前端 origin}/auth/callback?{credential-param}=<凭证>
⑤ 前端 AuthCallback 组件按 credential-param 取出凭证
   → POST /auth/sso/exchange { credential }
⑥ 后端 SsoAuthenticator：
   - 用凭证调 W3X 取用户信息（employeeNo / displayName / ...）
   - 按 employeeNo 查 sys_user；查到用现有记录（保留其角色/团队），
     查不到首次建档为 SUBMITTER
   - 签发本系统 JWT，返回 { token, user }
⑦ 前端存 token 到 localStorage → 后续请求带 X-Auth-Token 头
```

### 同域可选优化（SsoAuthFilter）

若前端与 W3X **同域**（W3 cookie 作用域覆盖到本系统），浏览器会自动带 cookie，`SsoAuthFilter` 会在首个请求里隐式完成「cookie → JWT」换发，并通过 `X-Auth-Token` **响应头**回传给前端（前端 `persistTokenFromResponse` 自动存储）。跨域场景下此过滤器读不到 cookie，自然透传，不影响主流程。

## 三、接缝清单（内网部署方重点看这里）

接入 W3 SSO **只需要改这三处**，其余代码已就绪：

### 接缝 1：配置（`backend/src/main/resources/application.yml` 或环境变量）

```yaml
app:
  sso:
    enabled: true                                              # DTS_SSO_ENABLED=true
    user-info-url: https://w3x.your-corp.com/api/user          # DTS_SSO_USER_INFO_URL
    login-page-url: https://w3.your-corp.com/login             # DTS_SSO_LOGIN_PAGE_URL
    redirect-param: redirect                                   # DTS_SSO_REDIRECT_PARAM（W3 登录页认的回跳参数名）
    credential-param: token                                    # DTS_SSO_CREDENTIAL_PARAM（W3 回跳 URL 带凭证的参数名）
    cookie-name: W3_TOKEN                                      # DTS_SSO_COOKIE_NAME（同域场景 SsoAuthFilter 读的 cookie 名）
```

生产同时设 `DTS_AUTH_LOCAL_ENABLED=false`（关闭本地登录兜底）。

### 接缝 2：W3X 请求构造（`W3xSsoUserService.fetchByCookie()`）

默认假设 W3X 契约：
```
GET {user-info-url}
Cookie: {cookie-name}={credential}
200 → JSON: { "employeeNo": "...", "username": "...", "displayName": "...", "email": "..." }
```

**若 W3X 的鉴权方式不同**（例如用 `?token=xxx` query 参数，或 `Authorization` 头），改 `fetchByCookie()` 里这一段（文件内有 `▼▼▼` 标注）：

```java
// 默认：Cookie 头透传
.header("Cookie", ssoProperties.getCookieName() + "=" + credentialValue)
```

### 接缝 3：字段映射（`W3xSsoUserService.mapUser()`）

W3X 返回的 JSON 字段名若与本系统假设不同，改 `mapUser()`：

```java
protected SsoUserInfo mapUser(JsonNode node) {
    return SsoUserInfo.builder()
            .employeeNo(text(node, "employeeNo"))    // ← 改成 W3X 实际字段名，如 "emp_no"
            .username(text(node, "username"))        // ← 如 "login_name"
            .displayName(text(node, "displayName"))  // ← 如 "name"
            .email(text(node, "email"))              // ← 如 "mail"
            .build();
}
```

> 若 W3X 契约差异极大（如走 SOAP、需要 AppKey/签名），可另行实现 `SsoUserService` 接口覆盖默认 Bean，无需改动 `SsoAuthFilter` / `SsoAuthenticator`。

## 四、字段映射全链路

```
W3X 响应 JSON
  └─ W3xSsoUserService.mapUser()
       └─ SsoUserInfo { employeeNo, username, displayName, email }
            └─ SsoAuthenticator.resolveOrCreateUser()
                 ├─ 按 employeeNo 查 sys_user（查到 → 用现有记录，保留角色/团队/密码）
                 └─ 查不到 → UserProvisioner.provisionSubmitter() 首次建档（角色=SUBMITTER）
                      └─ User { employeeNo, username, displayName, email, role, avatarColor, ... }
                           └─ JwtUtil.generate() 签发 JWT（claims: subject=userId, username, displayName, role, employeeNo, avatarColor, subModuleId）
                                └─ 前端存 token，后续请求 X-Auth-Token 头
                                     └─ JwtAuthFilter 解析 → LoginUser 填充 SecurityContext
```

## 五、账号匹配规则（重要）

SSO 登录的用户与现有 `sys_user` 的匹配：

1. **优先按 `employeeNo`（工号）查** —— 工号是 W3 的稳定标识。
2. 工号查不到且 W3X 返回了 `username` → 按 `username` 查。
3. 都查不到 → 首次建档为 `SUBMITTER`。

**已存在用户（LEADER / DEVELOPER）的角色、团队、密码不会被 SSO 覆盖**——这些由 `DataInitializer` 从 `dts-customization.yml` 的 `master-data.users` 维护。所以要让某个 SSO 用户是 LEADER/DEVELOPER，把其工号写进配置文件的 `master-data.users` 即可。

**工号缺失兜底**：若 W3X 未返回工号，建档时回退用 `username` 作为工号（避免拒绝合法用户），会记 WARN 日志。

## 六、本地开发模式兜底

非内网环境（开发 / 演示）保持默认配置即可：

```yaml
app:
  auth:
    local:
      enabled: true    # 默认
  sso:
    enabled: false     # 默认
```

此时 `/auth/mode` 返回 `mode=local`，前端显示账号密码登录页，演示账号（leader / wangwu 等，密码 `123456`）可用。

## 七、相关端点与头约定

| 端点 / 头 | 方法 | 说明 |
|-----------|------|------|
| `GET /auth/mode` | — | 返回认证模式与 SSO 配置（loginPageUrl / redirectParam / credentialParam） |
| `POST /auth/login` | local | 本地账号密码登录，返回 JWT |
| `POST /auth/sso/exchange` | sso | body: `{ credential }`，用凭证换 JWT |
| `GET /auth/me` | 两者 | 返回当前 LoginUser |
| 请求头 `X-Auth-Token` | 两者 | 携带 JWT（兼容仍带 `Bearer ` 前缀） |
| 响应头 `X-Auth-Token` | sso 同域 | SsoAuthFilter 隐式换发时回传 JWT |
| 请求头 `X-Admin-Token` | 两者 | 接入定制管理员的短时令牌（与认证正交，独立机制） |

## 八、对接前确认清单

1. **W3 登录页是否认 `redirect` 参数**？若用别的参数名，设 `app.sso.redirect-param`。
2. **W3 登录成功后如何回跳**？回跳 URL 里的凭证参数叫什么？设 `app.sso.credential-param`。
3. **W3X「取用户信息」接口**：URL、鉴权方式（Cookie / token query / Authorization 头）、返回字段名。
4. **前端域名与 W3 是否同域**？同域可享受 SsoAuthFilter 无感续签；跨域走显式 exchange（主流程）。
5. **CORS**：若前后端跨域，确保 `app.cors.allowed-origins` 含前端域名（已是 `allowCredentials=true`）。
6. **JWT 密钥**：生产必须 `DTS_JWT_SECRET=$(openssl rand -hex 32)`。

---

附：实现细节见 `backend/src/main/java/com/dts/security/` 下 `SsoAuthenticator` / `SsoAuthFilter` / `W3xSsoUserService` / `UserProvisioner` / `SsoProperties`，前端见 `frontend/src/store/auth.ts` 与 `frontend/src/pages/auth-callback.tsx`。
