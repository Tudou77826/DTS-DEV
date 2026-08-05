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
    }

    @Data
    public static class AuthMode {
        /** local = 本地账号密码；oauth = 反向代理注入用户头 */
        private String mode;
        private boolean localLoginEnabled;
    }
}
