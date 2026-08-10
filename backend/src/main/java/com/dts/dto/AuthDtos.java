package com.dts.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

public class AuthDtos {

    @Data
    public static class LoginRequest {
        @NotBlank(message = "用户名不能为空")
        private String username;
        @NotBlank(message = "密码不能为空")
        private String password;
    }

    @Data
    public static class RegisterRequest {
        @NotBlank(message = "工号不能为空")
        private String employeeNo;
        @NotBlank(message = "用户名不能为空")
        private String username;
        @NotBlank(message = "姓名不能为空")
        private String displayName;
        @NotBlank(message = "密码不能为空")
        private String password;
        private String role = "SUBMITTER";
        private String email;
        private String phone;
    }

    @Data
    public static class LoginResponse {
        private String token;
        private String tokenType = "Bearer";
        private UserVo user;
    }

    @Data
    public static class UserVo {
        private Long id;
        private String employeeNo;
        private String username;
        private String displayName;
        private String role;
        private String email;
        private String phone;
        private String avatarColor;
        /** 归属子模块 ID（null 表示无归属，如提出人） */
        private Long subModuleId;
    }

    @Data
    public static class AuthMode {
        /** local = 本地账号密码；sso = 公司统一身份源（W3/W3X） */
        private String mode;
        private boolean localLoginEnabled;
        /** 是否启用 SSO（前端据此判断 401 是否跳 W3 登录页）。 */
        private boolean ssoEnabled;
        /** SSO 登录页 URL（仅 ssoEnabled=true 时有意义，前端跳转用）。 */
        private String ssoLoginPageUrl;
        /** SSO 登录页识别的回跳参数名。 */
        private String ssoRedirectParam;
        /** W3 登录成功后回跳 URL 中携带 SSO 凭证的参数名（前端据此从回跳 URL 取凭证再换 token）。 */
        private String ssoCredentialParam;
    }

    /** SSO 回跳后前端换取本系统 JWT 的请求体：携带从 W3 回跳 URL 取到的凭证。 */
    @Data
    public static class SsoExchangeRequest {
        /** W3 回跳 URL 中携带的凭证值（cookie 值或一次性 token，由 W3 决定）。 */
        @NotBlank(message = "SSO 凭证不能为空")
        private String credential;
    }
}
