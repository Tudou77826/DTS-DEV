package com.dts.security;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.lang.NonNull;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;
import org.springframework.util.StringUtils;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.util.ArrayList;
import java.util.Collection;

/**
 * 解析管理员令牌（共享密码门禁签发），为当前认证追加 ROLE_ADMIN 权限。
 *
 * <p>管理员令牌是短时的独立 JWT，通过请求头 {@code X-Admin-Token} 传入。
 * 仅当请求已通过普通认证（JWT 或代理头）时，本过滤器才会在已有权限上追加管理员权限，
 * 从而放行 {@code @PreAuthorize("hasRole('ADMIN')")} 的接入定制接口。</p>
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class AdminTokenFilter extends OncePerRequestFilter {

    public static final String HEADER = "X-Admin-Token";

    private final JwtUtil jwtUtil;

    @Override
    protected void doFilterInternal(@NonNull HttpServletRequest request,
                                    @NonNull HttpServletResponse response,
                                    @NonNull FilterChain chain) throws ServletException, IOException {
        String adminToken = request.getHeader(HEADER);
        if (StringUtils.hasText(adminToken) && jwtUtil.isAdminToken(adminToken.trim())) {
            Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
            if (authentication != null && authentication.isAuthenticated()
                    && authentication.getPrincipal() instanceof LoginUser) {
                Collection<GrantedAuthority> authorities = new ArrayList<>(authentication.getAuthorities());
                if (authorities.stream().noneMatch(a -> "ROLE_ADMIN".equals(a.getAuthority()))) {
                    authorities.add(new SimpleGrantedAuthority("ROLE_ADMIN"));
                }
                SecurityContextHolder.getContext().setAuthentication(
                        new org.springframework.security.authentication.UsernamePasswordAuthenticationToken(
                                authentication.getPrincipal(), null, authorities));
            }
        }
        chain.doFilter(request, response);
    }
}
