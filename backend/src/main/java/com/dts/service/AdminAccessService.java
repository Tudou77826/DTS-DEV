package com.dts.service;

import com.dts.common.BusinessException;
import com.dts.config.DtsCustomizationProperties;
import com.dts.security.JwtUtil;
import lombok.Data;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;

/**
 * 接入定制管理入口的共享密码门禁。
 *
 * <p>系统不再维护管理员账号；任何已登录用户输入共享管理员密码后，
 * 获得一个短时管理员令牌，凭该令牌访问 {@code ROLE_ADMIN} 的接入定制接口。</p>
 */
@Service
@RequiredArgsConstructor
public class AdminAccessService {

    private static final int MIN_PASSWORD_LENGTH = 6;

    private final DtsCustomizationProperties customization;
    private final PasswordEncoder passwordEncoder;
    private final JwtUtil jwtUtil;
    private final CustomizationAdminService customizationAdminService;

    @Value("${app.admin-token.expiration-ms}")
    private long adminTokenExpirationMs;

    public VerifyResponse verify(String password) {
        String passwordHash = customization.getAdmin().getPasswordHash();
        if (!StringUtils.hasText(passwordHash)) {
            throw new BusinessException(403, "管理员密码尚未配置，请联系部署方在接入配置中设置 admin.password-hash");
        }
        if (!StringUtils.hasText(password) || !passwordEncoder.matches(password, passwordHash)) {
            throw new BusinessException(401, "管理员密码错误");
        }
        VerifyResponse resp = new VerifyResponse();
        resp.setToken(jwtUtil.generateAdminToken("admin", adminTokenExpirationMs));
        resp.setExpiresInMs(adminTokenExpirationMs);
        return resp;
    }

    /**
     * 修改共享管理员密码（BCrypt 哈希写回接入配置文件，重启后生效）。
     * 需要管理员令牌身份调用（接口层以 ROLE_ADMIN 保护）。
     */
    public void changePassword(String newPassword) {
        if (!StringUtils.hasText(newPassword)) {
            throw new BusinessException("新密码不能为空");
        }
        if (newPassword.length() < MIN_PASSWORD_LENGTH) {
            throw new BusinessException("新密码至少需要 " + MIN_PASSWORD_LENGTH + " 位");
        }
        if (newPassword.length() > 64) {
            throw new BusinessException("新密码过长（最多 64 位）");
        }
        String passwordHash = passwordEncoder.encode(newPassword);
        DtsCustomizationProperties next = new DtsCustomizationProperties();
        org.springframework.beans.BeanUtils.copyProperties(customization, next);
        if (next.getAdmin() == null) {
            next.setAdmin(new DtsCustomizationProperties.AdminConfig());
        }
        next.getAdmin().setPasswordHash(passwordHash);
        customizationAdminService.saveStructured(next);
    }

    @Data
    public static class VerifyResponse {
        private String token;
        private long expiresInMs;
    }
}
