package com.dts.security;

import com.fasterxml.jackson.databind.JsonNode;
import jakarta.annotation.PostConstruct;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;

import java.time.Duration;
import java.util.Optional;

/**
 * {@link SsoUserService} 的默认实现：用 {@link RestClient} GET 调用公司 W3/W3X「取用户信息」接口。
 *
 * <p><b>这是应用与公司统一身份源之间的唯一接缝——内网部署方接手时重点改这里。</b>
 * URL、cookie 名、超时、参数名均来自 {@code app.sso.*} 配置（见 {@link SsoProperties}），
 * 默认值全部为占位。</p>
 *
 * <p>本实现假设 W3X 契约为：
 * <pre>
 *   GET {app.sso.user-info-url}
 *   Cookie: {app.sso.cookie-name}={credential}
 *   200 → JSON：{ "employeeNo": "...", "username": "...", "displayName": "...", "email": "..." }
 *   401/4xx → 凭证无效，视为未登录
 * </pre>
 *
 * <p><b>方法名 {@code fetchByCookie} 历史遗留</b>：实际接收的 {@code credentialValue} 可能是
 * W3 cookie 的值，也可能是 W3 回跳带回的一次性 token——取决于 W3 的实现。方法语义是
 * 「用前端传来的凭证去身份源换用户信息」。</p>
 *
 * <p>若真实 W3X 契约与默认假设不同（鉴权方式不同、字段名不同、需要 AppKey/签名等），
 * 修改本类 {@link #fetchByCookie(String)} 的请求构造 与 {@link #mapUser(JsonNode)} 的字段映射即可，
 * 或自行实现 {@link SsoUserService} 覆盖此 Bean。详见 docs/SSO-INTEGRATION.md。</p>
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class W3xSsoUserService implements SsoUserService {

    private final SsoProperties ssoProperties;

    private RestClient restClient;

    @PostConstruct
    void initRestClient() {
        SsoProperties sso = ssoProperties;
        this.restClient = RestClient.builder()
                .baseUrl(sso.getUserInfoUrl())
                .requestFactory(new org.springframework.http.client.SimpleClientHttpRequestFactory() {{
                    setConnectTimeout((int) Duration.ofMillis(sso.getConnectTimeoutMs()).toMillis());
                    setReadTimeout((int) Duration.ofMillis(sso.getReadTimeoutMs()).toMillis());
                }})
                .build();
    }

    @Override
    public Optional<SsoUserInfo> fetchByCookie(String credentialValue) {
        if (credentialValue == null || credentialValue.isBlank()) {
            return Optional.empty();
        }
        try {
            JsonNode body = restClient.get()
                    // ▼▼▼ 内网接手最可能要改这一段：把凭证以 W3X 期望的方式传给身份源 ▼▼▼
                    // 默认假设：W3X 用 Cookie 鉴权，把凭证值作为同名 cookie 透传。
                    // 若 W3X 改用 query 参数（如 ?token=xxx）或 Authorization 头，改这里即可。
                    .header("Cookie", ssoProperties.getCookieName() + "=" + credentialValue)
                    .retrieve()
                    .body(JsonNode.class);
            if (body == null) {
                return Optional.empty();
            }
            return Optional.of(mapUser(body));
        } catch (Exception e) {
            // 401/超时/连接失败一律视为「未通过 SSO 认证」，让上游走 401 → 跳登录页。
            log.debug("W3X 取用户信息失败（cookie 可能已失效）: {}", e.getMessage());
            return Optional.empty();
        }
    }

    /**
     * 把 W3X 原始响应映射为 {@link SsoUserInfo}。
     * 若字段名与真实 W3X 不一致，改本方法即可。
     */
    protected SsoUserInfo mapUser(JsonNode node) {
        return SsoUserInfo.builder()
                .employeeNo(text(node, "employeeNo"))
                .username(text(node, "username"))
                .displayName(text(node, "displayName"))
                .email(text(node, "email"))
                .build();
    }

    private static String text(JsonNode node, String field) {
        JsonNode child = node.get(field);
        return child != null && !child.isNull() ? child.asText() : null;
    }
}
