package com.dts.config;

import lombok.Data;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;

/**
 * 认证方式配置（仅本地登录开关）。
 *
 * <p>支持两种互斥模式（由 {@code app.sso.enabled} 决定，见 {@code SsoProperties}）：
 * <ul>
 *   <li>{@code sso}：应用主动调用公司统一身份源（W3/W3X）拿用户身份，cookie 有效即换 JWT。</li>
 *   <li>{@code local}：本地账号密码登录，用于非内网环境（开发/演示）。生产应关闭。</li>
 * </ul>
 * 本类只承载本地登录开关；SSO 相关配置独立在 {@code com.dts.security.SsoProperties}，
 * 以保持 security 与 config 包之间无依赖环。</p>
 */
@Data
@Component
@ConfigurationProperties(prefix = "app")
public class AppAuthProperties {

    private Auth auth = new Auth();

    @Data
    public static class Auth {
        private Local local = new Local();

        @Data
        public static class Local {
            /** 是否允许本地账号密码登录（开发/非内网环境开关）。 */
            private boolean enabled = false;
        }
    }

    public boolean isLocalEnabled() {
        return auth.local.isEnabled();
    }
}
