package com.dts.service;

import com.dts.common.BusinessException;
import com.dts.config.DtsCustomizationProperties;
import com.dts.security.JwtUtil;
import org.junit.jupiter.api.Test;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.util.ReflectionTestUtils;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * 管理员共享密码门禁测试：密码校验 + 短时管理员令牌签发。
 */
class AdminAccessServiceTest {

    private final PasswordEncoder encoder = new BCryptPasswordEncoder();
    private final String rawPassword = "admin123";
    private final String passwordHash = encoder.encode(rawPassword);
    private final JwtUtil jwtUtil = new JwtUtil(
            "test-secret-key-that-is-long-enough-for-hmac-32bytes", 3600000L);

    private AdminAccessService build(String hash) {
        DtsCustomizationProperties customization = new DtsCustomizationProperties();
        customization.getAdmin().setPasswordHash(hash);
        AdminAccessService service = new AdminAccessService(customization, encoder, jwtUtil, null);
        // @Value 字段在纯单元测试中不注入，手动设置管理员令牌有效期
        ReflectionTestUtils.setField(service, "adminTokenExpirationMs", 1800000L);
        return service;
    }

    @Test
    void wrongPasswordIsRejected() {
        AdminAccessService service = build(passwordHash);
        BusinessException error = assertThrows(BusinessException.class,
                () -> service.verify("wrong-password"));
        assertEquals(401, error.getCode());
    }

    @Test
    void correctPasswordIssuesAdminToken() {
        AdminAccessService service = build(passwordHash);
        AdminAccessService.VerifyResponse response = service.verify(rawPassword);
        assertNotNull(response.getToken());
        assertTrue(response.getExpiresInMs() > 0);
        assertTrue(jwtUtil.isAdminToken(response.getToken()));
        assertFalse(jwtUtil.isAdminToken("not-a-token"));
    }

    @Test
    void missingPasswordHashIsRejected() {
        AdminAccessService service = build(null);
        BusinessException error = assertThrows(BusinessException.class,
                () -> service.verify(rawPassword));
        assertEquals(403, error.getCode());
    }

    @Test
    void newPasswordMustMeetMinimumLength() {
        AdminAccessService service = build(passwordHash);
        assertThrows(BusinessException.class, () -> service.changePassword("12345"));
        assertThrows(BusinessException.class, () -> service.changePassword(null));
    }
}
