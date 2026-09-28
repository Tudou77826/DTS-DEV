package com.dts.config;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.dts.common.ApiResponse;
import com.dts.security.AdminTokenFilter;
import com.dts.security.JwtAuthFilter;
import com.dts.security.SsoAuthFilter;
import com.dts.security.SsoProperties;
import lombok.RequiredArgsConstructor;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.core.env.Environment;
import org.springframework.http.MediaType;
import org.springframework.security.config.annotation.method.configuration.EnableMethodSecurity;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configurers.AbstractHttpConfigurer;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.CorsConfigurationSource;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;

import java.nio.charset.StandardCharsets;
import java.util.Arrays;
import java.util.List;

@Configuration
@EnableMethodSecurity
@RequiredArgsConstructor
public class SecurityConfig {

    private final JwtAuthFilter jwtAuthFilter;
    private final SsoAuthFilter ssoAuthFilter;
    private final AdminTokenFilter adminTokenFilter;
    private final SsoProperties ssoProperties;
    private final Environment env;

    @Bean
    public PasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder();
    }

    @Bean
    public CorsConfigurationSource corsConfigurationSource() {
        String origins = env.getProperty("app.cors.allowed-origins", "http://localhost:5173");
        CorsConfiguration cfg = new CorsConfiguration();
        cfg.setAllowedOrigins(Arrays.asList(origins.split(",")));
        cfg.setAllowedMethods(List.of("GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"));
        cfg.setAllowedHeaders(List.of("*"));
        cfg.setAllowCredentials(true);
        cfg.setMaxAge(3600L);
        UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
        source.registerCorsConfiguration("/**", cfg);
        return source;
    }

    @Bean
    public SecurityFilterChain filterChain(HttpSecurity http, ObjectMapper mapper) throws Exception {
        String unauthJson = mapper.writeValueAsString(ApiResponse.error(401, "未登录或登录已过期"));

        http
                .cors(c -> c.configurationSource(corsConfigurationSource()))
                .csrf(AbstractHttpConfigurer::disable)
                .sessionManagement(s -> s.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
                .authorizeHttpRequests(reg -> reg
                        // 公开端点
                        .requestMatchers("/auth/login", "/auth/register", "/auth/mode", "/auth/sso/**",
                                "/config/customization", "/config/customization/admin/verify",
                                "/ai-location/internal/questions").permitAll()
                        .requestMatchers("/swagger-ui/**", "/v3/api-docs/**").permitAll()
                        .requestMatchers("/actuator/**").permitAll()
                        .anyRequest().authenticated())
                .exceptionHandling(eh -> eh
                        .authenticationEntryPoint((req, resp, authEx) -> {
                            // 暴露当前认证模式，前端据此决定 401 跳转目标（sso→W3 登录页 / local→登录表单）
                            resp.setHeader("X-DTS-Auth-Mode", ssoProperties.isEnabled() ? "sso" : "local");
                            resp.setStatus(401);
                            resp.setContentType(MediaType.APPLICATION_JSON_VALUE);
                            resp.setCharacterEncoding(StandardCharsets.UTF_8.name());
                            resp.getWriter().write(unauthJson);
                        }))
                // 认证顺序：本地 JWT → SSO（W3/W3X）→ 管理员令牌（追加 ROLE_ADMIN）
                .addFilterBefore(jwtAuthFilter, UsernamePasswordAuthenticationFilter.class)
                .addFilterBefore(ssoAuthFilter, UsernamePasswordAuthenticationFilter.class)
                .addFilterBefore(adminTokenFilter, UsernamePasswordAuthenticationFilter.class);

        return http.build();
    }
}
