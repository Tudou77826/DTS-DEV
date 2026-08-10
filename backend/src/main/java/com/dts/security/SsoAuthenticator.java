package com.dts.security;

import com.dts.common.BusinessException;
import com.dts.domain.User;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import java.util.Optional;

/**
 * SSO 认证编排：把「SSO cookie → 用户身份 → 本地用户 → JWT」的链路一次性走完。
 *
 * <p>同时服务于两条入口：
 * <ul>
 *   <li>{@code SsoAuthFilter}：浏览器带 SSO cookie 进来时，隐式建立会话并回写 JWT 响应头；</li>
 *   <li>{@code AuthService#ssoExchange}：前端回跳后显式调用，换取 JWT 作为响应体。</li>
 * </ul>
 * 两条路径共用同一套查/建档/签发逻辑，避免行为分叉。</p>
 *
 * <p>会话维持策略：SSO 成功后签发 JWT，前端存 JWT，后续请求由 {@code JwtAuthFilter} 接管，
 * 因此 {@link SsoUserService}（调 W3X）只在首次进入/JWT 过期时触发一次，热路径无外部调用。</p>
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class SsoAuthenticator {

    private final SsoProperties ssoProperties;
    private final SsoUserService ssoUserService;
    private final UserProvisioner userProvisioner;
    private final JwtUtil jwtUtil;

    /**
     * 用请求中携带的 SSO cookie 进行认证。
     *
     * @param cookieValue SSO cookie 的值（可能为空）
     * @return 认证成功则 {@link Optional#of(SsoSession)}；cookie 为空/无效则 {@link Optional#empty()}
     * @throws BusinessException 账号已停用（403）或 SSO 返回的身份不可用（401）
     */
    public Optional<SsoSession> authenticate(String cookieValue) {
        if (!ssoProperties.isEnabled()) {
            return Optional.empty();
        }
        Optional<SsoUserInfo> info = ssoUserService.fetchByCookie(cookieValue);
        if (info.isEmpty()) {
            return Optional.empty();
        }
        SsoUserInfo sso = info.get();
        if (sso.getEmployeeNo() == null && sso.getUsername() == null) {
            log.warn("SSO 返回的身份缺少工号与用户名，拒绝建档");
            throw new BusinessException(401, "统一认证返回的身份信息不完整");
        }
        User user = resolveOrCreateUser(sso);
        if (!Boolean.TRUE.equals(user.getActive())) {
            throw new BusinessException(403, "账号已被停用");
        }
        String token = jwtUtil.generate(user.getId(), user.getUsername(), user.getDisplayName(),
                user.getRole(), user.getEmployeeNo(), user.getAvatarColor(), user.getSubModuleId());
        return Optional.of(new SsoSession(user, token));
    }

    /**
     * 优先按工号（SSO 的稳定标识）查；身份源未给工号时退而按用户名查；都没有则建档。
     * 已存在用户：不改动其角色/团队/密码（这些由接入配置维护），仅据此建立会话。
     */
    private User resolveOrCreateUser(SsoUserInfo sso) {
        User user = null;
        if (sso.getEmployeeNo() != null) {
            user = userProvisioner.findByEmployeeNo(sso.getEmployeeNo());
        }
        if (user == null && sso.getUsername() != null) {
            user = userProvisioner.findByUsername(sso.getUsername());
        }
        if (user != null) {
            return user;
        }
        return userProvisioner.provisionSubmitter(sso.getEmployeeNo(), sso.getUsername(),
                sso.getDisplayName(), sso.getEmail());
    }
}
