package com.dts.security;

import io.jsonwebtoken.Claims;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.lang.NonNull;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.web.authentication.WebAuthenticationDetailsSource;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;

/**
 * 解析请求头中的 JWT 并填充 SecurityContext。
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class JwtAuthFilter extends OncePerRequestFilter {

    private final JwtUtil jwtUtil;

    @Override
    protected void doFilterInternal(@NonNull HttpServletRequest request,
                                    @NonNull HttpServletResponse response,
                                    @NonNull FilterChain chain) throws ServletException, IOException {
        // 统一用 X-Auth-Token 头携带 JWT（本地登录 / SSO 换发的 token 走同一个头）。
        // 兼容仍带 "Bearer " 前缀的旧客户端，逐步过渡到纯 token。
        String raw = request.getHeader("X-Auth-Token");
        if (raw != null) {
            String token = raw.trim();
            if (token.startsWith("Bearer ")) {
                token = token.substring(7).trim();
            }
            try {
                Claims claims = jwtUtil.parse(token);
                LoginUser user = new LoginUser(
                        Long.valueOf(claims.getSubject()),
                        claims.get("username", String.class),
                        claims.get("displayName", String.class),
                        claims.get("role", String.class),
                        claims.get("employeeNo", String.class),
                        claims.get("avatarColor", String.class),
                        claims.get("subModuleId", Long.class));
                UsernamePasswordAuthenticationToken auth =
                        new UsernamePasswordAuthenticationToken(user, null, user.getAuthorities());
                auth.setDetails(new WebAuthenticationDetailsSource().buildDetails(request));
                SecurityContextHolder.getContext().setAuthentication(auth);
            } catch (Exception e) {
                log.debug("invalid jwt: {}", e.getMessage());
                SecurityContextHolder.clearContext();
            }
        }
        chain.doFilter(request, response);
    }
}
