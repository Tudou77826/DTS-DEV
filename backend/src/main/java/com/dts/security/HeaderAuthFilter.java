package com.dts.security;

import com.dts.common.BusinessException;
import com.dts.domain.User;
import com.dts.mapper.UserMapper;
import com.baomidou.mybatisplus.core.toolkit.Wrappers;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.MediaType;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.web.authentication.WebAuthenticationDetailsSource;
import org.springframework.stereotype.Component;
import org.springframework.util.StringUtils;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.util.List;

/**
 * 信任反向代理（OAuth 认证网关）注入的用户身份头，建立登录态。
 *
 * <p>网关认证通过后应注入 {@code app.oauth.header.*} 配置的用户头（用户名、显示名等），
 * 并剥离外部伪造的同类请求头。本过滤器按用户名查找运行库中的用户：
 * <ul>
 *   <li>已存在：使用运行库中的角色构建登录态（角色由配置/建档维护）；</li>
 *   <li>不存在：自动建档为普通提出人（SUBMITTER，无密码），后续可由接入配置升级为责任人。</li>
 * </ul>
 * 停用的账号拒绝访问。</p>
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class HeaderAuthFilter extends OncePerRequestFilter {

    private static final List<String> AVATAR_COLORS =
            List.of("#6366f1", "#0ea5e9", "#10b981", "#f59e0b", "#ec4899", "#8b5cf6", "#ef4444", "#14b8a6");

    private final UserMapper userMapper;
    private final ObjectMapper objectMapper;

    @Value("${app.oauth.header.enabled}")
    private boolean headerAuthEnabled;

    @Value("${app.oauth.header.username-header:X-Auth-User}")
    private String usernameHeader;

    @Value("${app.oauth.header.display-name-header:X-Auth-Display-Name}")
    private String displayNameHeader;

    @Value("${app.oauth.header.email-header:X-Auth-Email}")
    private String emailHeader;

    @Value("${app.oauth.header.employee-no-header:X-Auth-Employee-No}")
    private String employeeNoHeader;

    @Override
    protected void doFilterInternal(HttpServletRequest request,
                                    HttpServletResponse response,
                                    FilterChain chain) throws ServletException, IOException {
        if (headerAuthEnabled && SecurityContextHolder.getContext().getAuthentication() == null) {
            String username = request.getHeader(usernameHeader);
            if (StringUtils.hasText(username)) {
                try {
                    authenticate(request, response, username.trim());
                } catch (BusinessException e) {
                    writeError(response, e.getCode(), e.getMessage());
                    return;
                }
            }
        }
        chain.doFilter(request, response);
    }

    private void authenticate(HttpServletRequest request, HttpServletResponse response, String username) {
        User user = userMapper.selectOne(Wrappers.<User>lambdaQuery()
                .eq(User::getUsername, username).last("LIMIT 1"));
        if (user == null) {
            user = provision(request, username);
        }
        if (!Boolean.TRUE.equals(user.getActive())) {
            throw new BusinessException(403, "账号已被停用");
        }
        LoginUser loginUser = new LoginUser(user.getId(), user.getUsername(), user.getDisplayName(),
                user.getRole(), user.getEmployeeNo(), user.getAvatarColor(), user.getSubModuleId());
        UsernamePasswordAuthenticationToken auth =
                new UsernamePasswordAuthenticationToken(loginUser, null, loginUser.getAuthorities());
        auth.setDetails(new WebAuthenticationDetailsSource().buildDetails(request));
        SecurityContextHolder.getContext().setAuthentication(auth);
    }

    /**
     * 首次登录自动建档：默认普通提出人（SUBMITTER）、无密码，
     * 员工号缺省使用用户名，显示名缺省使用用户名。
     */
    private User provision(HttpServletRequest request, String username) {
        User user = new User();
        user.setUsername(username);
        user.setEmployeeNo(blankToNull(request.getHeader(employeeNoHeader), username));
        user.setDisplayName(blankToNull(request.getHeader(displayNameHeader), username));
        user.setEmail(blankToNull(request.getHeader(emailHeader), null));
        user.setRole("SUBMITTER");
        user.setAvatarColor(AVATAR_COLORS.get(Math.floorMod(username.hashCode(), AVATAR_COLORS.size())));
        user.setActive(true);
        userMapper.insert(user);
        log.info("OAuth 首次登录自动建档用户: {}", username);
        return user;
    }

    private String blankToNull(String value, String fallback) {
        return StringUtils.hasText(value) ? value.trim() : fallback;
    }

    private void writeError(HttpServletResponse response, int status, String message) throws IOException {
        response.setStatus(status);
        response.setContentType(MediaType.APPLICATION_JSON_VALUE);
        response.setCharacterEncoding(StandardCharsets.UTF_8.name());
        response.getWriter().write(objectMapper.writeValueAsString(
                com.dts.common.ApiResponse.error(status, message)));
    }
}
