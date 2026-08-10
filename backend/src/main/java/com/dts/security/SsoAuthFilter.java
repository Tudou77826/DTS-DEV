package com.dts.security;

import com.dts.common.ApiResponse;
import com.dts.common.BusinessException;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.Cookie;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.MediaType;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.web.authentication.WebAuthenticationDetailsSource;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.util.Optional;

/**
 * 用浏览器携带的 SSO 会话 cookie 建立登录态，并把签发的 JWT 通过响应头回传前端。
 *
 * <p>仅在 {@code app.sso.enabled=true} 时生效；本地登录环境（未启用 SSO）此过滤器完全透传，
 * 不影响既有账号密码流程。</p>
 *
 * <p>典型流程：
 * <ol>
 *   <li>浏览器首次进入（无 JWT，但带 SSO cookie）→ 本过滤器调 {@link SsoAuthenticator}
 *       认证成功 → 建 SecurityContext + 响应头 {@code X-DTS-Token} 写回 JWT；前端读到后存本地。</li>
 *   <li>后续请求（前端带 JWT）→ {@code JwtAuthFilter} 先认领身份，本过滤器见 SecurityContext
 *       已有认证直接放行，不再调 W3X。</li>
 *   <li>JWT 过期/SSO cookie 失效 → 请求匿名通过，由 SecurityConfig 的 401 入口点触发前端跳转登录。</li>
 * </ol>
 * 因此 W3X 仅在「首次进入 / JWT 过期后重新换发」时被调用一次，热路径零外部开销。</p>
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class SsoAuthFilter extends OncePerRequestFilter {

    /** 把 SSO 成功后签发的 JWT 通过此响应头回传给前端（与本地登录统一头名）。 */
    public static final String TOKEN_HEADER = "X-Auth-Token";

    private final SsoAuthenticator ssoAuthenticator;
    private final SsoProperties ssoProperties;
    private final ObjectMapper objectMapper;

    @Override
    protected void doFilterInternal(HttpServletRequest request,
                                    HttpServletResponse response,
                                    FilterChain chain) throws ServletException, IOException {
        if (ssoProperties.isEnabled()
                && SecurityContextHolder.getContext().getAuthentication() == null) {
            String cookieValue = readSsoCookie(request);
            if (cookieValue != null) {
                try {
                    Optional<SsoSession> session = ssoAuthenticator.authenticate(cookieValue);
                    if (session.isPresent()) {
                        applySession(request, response, session.get());
                    }
                } catch (BusinessException e) {
                    writeError(response, e.getCode(), e.getMessage());
                    return;
                }
            }
        }
        chain.doFilter(request, response);
    }

    private String readSsoCookie(HttpServletRequest request) {
        String name = ssoProperties.getCookieName();
        Cookie[] cookies = request.getCookies();
        if (cookies == null) {
            return null;
        }
        for (Cookie c : cookies) {
            if (name.equals(c.getName())) {
                return c.getValue();
            }
        }
        return null;
    }

    private void applySession(HttpServletRequest request, HttpServletResponse response, SsoSession session) {
        LoginUser loginUser = session.toLoginUser();
        UsernamePasswordAuthenticationToken auth =
                new UsernamePasswordAuthenticationToken(loginUser, null, loginUser.getAuthorities());
        auth.setDetails(new WebAuthenticationDetailsSource().buildDetails(request));
        SecurityContextHolder.getContext().setAuthentication(auth);
        response.setHeader(TOKEN_HEADER, session.getToken());
    }

    private void writeError(HttpServletResponse response, int status, String message) throws IOException {
        response.setStatus(status);
        response.setContentType(MediaType.APPLICATION_JSON_VALUE);
        response.setCharacterEncoding(StandardCharsets.UTF_8.name());
        response.getWriter().write(objectMapper.writeValueAsString(ApiResponse.error(status, message)));
    }
}
