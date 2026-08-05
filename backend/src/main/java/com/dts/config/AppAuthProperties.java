package com.dts.config;

import lombok.Data;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;

/**
 * 认证方式配置。
 *
 * <p>oauth（代理注入用户头）启用后，本地账号密码登录自动视为辅助/开发模式，
 * 生产环境应保持 {@code oauth.header.enabled=true}、{@code auth.local.enabled=false}。</p>
 */
@Data
@Component
@ConfigurationProperties(prefix = "app")
public class AppAuthProperties {

    private Auth auth = new Auth();
    private Oauth oauth = new Oauth();

    @Data
    public static class Auth {
        private Local local = new Local();

        @Data
        public static class Local {
            /** 是否允许本地账号密码登录（开发模式开关）。 */
            private boolean enabled = false;
        }
    }

    @Data
    public static class Oauth {
        private Header header = new Header();

        @Data
        public static class Header {
            /** 是否信任反向代理注入的用户头。 */
            private boolean enabled = false;
            /** 用户名请求头，由 OAuth 认证网关注入。 */
            private String usernameHeader = "X-Auth-User";
            /** 显示名请求头。 */
            private String displayNameHeader = "X-Auth-Display-Name";
            /** 邮箱请求头（可选）。 */
            private String emailHeader = "X-Auth-Email";
            /** 工号请求头（可选）。 */
            private String employeeNoHeader = "X-Auth-Employee-No";
        }
    }

    public boolean isHeaderEnabled() {
        return oauth.header.isEnabled();
    }

    public boolean isLocalEnabled() {
        return auth.local.isEnabled();
    }
}
