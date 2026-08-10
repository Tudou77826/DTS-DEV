package com.dts.security;

import lombok.Data;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;

/**
 * SSO（公司统一身份源 W3/W3X）配置，绑定 {@code app.sso.*}。
 *
 * <p>独立成 bean 放在 security 包，避免 security 与 config 包之间形成依赖环
 * （{@code ArchitectureTest} 约束包间无循环依赖）。各字段默认值为占位，
 * 由内网部署方通过环境变量填入真实值后置 {@code enabled=true} 即可生效。</p>
 */
@Data
@Component
@ConfigurationProperties(prefix = "app.sso")
public class SsoProperties {

    /** 是否启用 SSO（应用主动调 W3/W3X）。启用后身份来自统一身份源，本地登录仅作兜底。 */
    private boolean enabled = false;

    /** W3X「按 cookie 取用户信息」的 GET 接口（占位，由部署方填真实 URL）。 */
    private String userInfoUrl = "https://w3x.example.com/api/user";

    /** W3 登录页 URL；前端在 SSO 会话失效（401）时跳转至此（占位）。 */
    private String loginPageUrl = "https://w3.example.com/login";

    /** W3 登录页识别的回跳参数名。 */
    private String redirectParam = "redirect";

    /**
     * W3 登录成功后，回跳 URL 中携带 SSO 凭证（cookie 值或一次性 token）的参数名。
     * 前端从回跳 URL 按此参数取到凭证后，POST 到 /auth/sso/exchange 换取本系统 JWT。
     * 跨域场景下浏览器 JS 读不到 W3 cookie，只能靠 W3 把凭证回带到前端 URL。
     */
    private String credentialParam = "token";

    /** SSO 会话 cookie 的名称（占位）。仅同域场景下 SsoAuthFilter 会读取浏览器 cookie。 */
    private String cookieName = "W3_TOKEN";

    /** 调用 W3X 的连接超时（毫秒）。 */
    private int connectTimeoutMs = 3000;

    /** 调用 W3X 的读取超时（毫秒）。 */
    private int readTimeoutMs = 5000;
}
