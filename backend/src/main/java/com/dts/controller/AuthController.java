package com.dts.controller;

import com.dts.common.ApiResponse;
import com.dts.common.BusinessException;
import com.dts.config.AppAuthProperties;
import com.dts.dto.AuthDtos;
import com.dts.security.LoginUser;
import com.dts.security.SecurityUtil;
import com.dts.security.SsoAuthenticator;
import com.dts.security.SsoProperties;
import com.dts.security.SsoSession;
import com.dts.service.AuthService;
import jakarta.servlet.http.Cookie;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/auth")
@RequiredArgsConstructor
public class AuthController {

    private final AuthService authService;
    private final AppAuthProperties appAuthProperties;
    private final SsoProperties ssoProperties;
    private final SsoAuthenticator ssoAuthenticator;

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

    /**
     * 登录方式与前端可达性配置。前端据此决定：
     * <ul>
     *   <li>渲染本地登录表单（mode=local）还是「统一认证登录」入口（mode=sso）；</li>
     *   <li>401 时跳本地 /login 还是外跳 W3 登录页（ssoLoginPageUrl）；</li>
     *   <li>W3 回跳后按 ssoCredentialParam 取凭证，POST 到 /auth/sso/exchange 换 token。</li>
     * </ul>
     */
    @GetMapping("/mode")
    public ApiResponse<AuthDtos.AuthMode> mode() {
        AuthDtos.AuthMode mode = new AuthDtos.AuthMode();
        boolean ssoEnabled = ssoProperties.isEnabled();
        mode.setMode(ssoEnabled ? "sso" : "local");
        mode.setLocalLoginEnabled(appAuthProperties.isLocalEnabled());
        mode.setSsoEnabled(ssoEnabled);
        mode.setSsoLoginPageUrl(ssoEnabled ? ssoProperties.getLoginPageUrl() : null);
        mode.setSsoRedirectParam(ssoEnabled ? ssoProperties.getRedirectParam() : null);
        mode.setSsoCredentialParam(ssoEnabled ? ssoProperties.getCredentialParam() : null);
        return ApiResponse.ok(mode);
    }

    /**
     * SSO 登录回跳后的「换 token」端点：前端从 W3 回跳 URL 取到凭证后，
     * POST 凭证到此处换本系统的 JWT。
     *
     * <p>跨域场景（前端 JS 读不到 W3 cookie）：W3 登录成功后把凭证带回前端回跳 URL，
     * 前端按 {@link SsoProperties#getCredentialParam()} 取出凭证，POST 到本端点。
     * 同域场景：若浏览器能自动带 cookie，{@code SsoAuthFilter} 会隐式完成换发，
     * 本端点仍可作为显式兜底。</p>
     */
    @PostMapping("/sso/exchange")
    public ApiResponse<AuthDtos.LoginResponse> ssoExchange(@Valid @RequestBody AuthDtos.SsoExchangeRequest req) {
        if (!ssoProperties.isEnabled()) {
            throw new BusinessException(403, "系统未启用 SSO");
        }
        SsoSession session = ssoAuthenticator.authenticate(req.getCredential())
                .orElseThrow(() -> new BusinessException(401, "SSO 会话已失效，请重新登录"));
        return ApiResponse.ok(authService.buildSsoResponse(session));
    }
}
