package com.dts.security;

import java.util.Optional;

/**
 * 「以 SSO 会话凭证取用户身份」的服务抽象。
 *
 * <p>这是应用与公司统一身份源（W3/W3X）之间的唯一接缝。默认实现
 * {@link W3xSsoUserService} 用 HTTP 调用 W3X 接口；若内网部署方的 W3X 契约与默认实现差异较大
 * （例如需要额外的 AppKey/签名、走的是 SOAP、或返回字段名不同），可另行提供本接口的实现
 * 覆盖默认 Bean，无需改动 {@code SsoAuthFilter} / {@code SsoAuthenticator}。</p>
 */
public interface SsoUserService {

    /**
     * 用 SSO 会话 cookie 的值去身份源换取用户身份。
     *
     * @param cookieValue SSO cookie 的值（来自浏览器请求，由调用方从配置的 cookie 名读取）
     * @return 身份源确认有效时返回用户身份；cookie 无效/过期/身份源不可达时返回 {@link Optional#empty()}
     */
    Optional<SsoUserInfo> fetchByCookie(String cookieValue);
}
