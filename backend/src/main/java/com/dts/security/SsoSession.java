package com.dts.security;

import com.dts.domain.User;
import lombok.AllArgsConstructor;
import lombok.Getter;

/**
 * SSO 认证成功的结果：已就绪的 {@link User} 与签发好的 JWT。
 * 由 {@link SsoAuthenticator} 产出，供 {@code SsoAuthFilter}（写入请求上下文/响应头）
 * 与 {@code AuthService#ssoExchange}（作为接口响应体）共用。
 */
@Getter
@AllArgsConstructor
public class SsoSession {

    private final User user;
    private final String token;

    public LoginUser toLoginUser() {
        return new LoginUser(user.getId(), user.getUsername(), user.getDisplayName(),
                user.getRole(), user.getEmployeeNo(), user.getAvatarColor(), user.getSubModuleId());
    }
}
