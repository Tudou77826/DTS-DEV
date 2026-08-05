package com.dts.controller;

import com.dts.common.ApiResponse;
import com.dts.dto.AuthDtos;
import com.dts.security.LoginUser;
import com.dts.security.SecurityUtil;
import com.dts.service.AuthService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/auth")
@RequiredArgsConstructor
public class AuthController {

    private final AuthService authService;
    private final com.dts.config.AppAuthProperties appAuthProperties;

    @PostMapping("/login")
    public ApiResponse<AuthDtos.LoginResponse> login(@Valid @RequestBody AuthDtos.LoginRequest req) {
        return ApiResponse.ok(authService.login(req));
    }

    @PostMapping("/register")
    public ApiResponse<AuthDtos.LoginResponse> register(@Valid @RequestBody AuthDtos.RegisterRequest req) {
        return ApiResponse.ok(authService.register(req));
    }

    @GetMapping("/me")
    public ApiResponse<LoginUser> me() {
        return ApiResponse.ok(SecurityUtil.current());
    }

    /** 登录方式：local = 本地账号密码；oauth = 反向代理注入用户头。 */
    @GetMapping("/mode")
    public ApiResponse<AuthDtos.AuthMode> mode() {
        AuthDtos.AuthMode mode = new AuthDtos.AuthMode();
        mode.setMode(appAuthProperties.isHeaderEnabled() ? "oauth" : "local");
        mode.setLocalLoginEnabled(appAuthProperties.isLocalEnabled());
        return ApiResponse.ok(mode);
    }
}
