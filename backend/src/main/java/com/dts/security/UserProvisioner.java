package com.dts.security;

import com.dts.domain.User;
import com.dts.mapper.UserMapper;
import com.baomidou.mybatisplus.core.toolkit.Wrappers;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;
import org.springframework.util.StringUtils;

import java.util.List;

/**
 * 用户建档与查找的统一入口。
 *
 * <p>把原先散落在 {@code HeaderAuthFilter} 与 {@code AuthService} 的「按工号/用户名查用户、
 * 首次登录建档、头像取色」逻辑收敛到此，供 SSO 过滤器与本地登录共用，避免规则漂移。</p>
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class UserProvisioner {

    public static final List<String> AVATAR_COLORS =
            List.of("#6366f1", "#0ea5e9", "#10b981", "#f59e0b", "#ec4899", "#8b5cf6", "#ef4444", "#14b8a6");

    private final UserMapper userMapper;

    public User findByEmployeeNo(String employeeNo) {
        if (!StringUtils.hasText(employeeNo)) {
            return null;
        }
        return userMapper.selectOne(Wrappers.<User>lambdaQuery()
                .eq(User::getEmployeeNo, employeeNo.trim()).last("LIMIT 1"));
    }

    public User findByUsername(String username) {
        if (!StringUtils.hasText(username)) {
            return null;
        }
        return userMapper.selectOne(Wrappers.<User>lambdaQuery()
                .eq(User::getUsername, username.trim()).last("LIMIT 1"));
    }

    /**
     * 首次登录建档：普通提出人（SUBMITTER）、无密码（即不能用于本地登录）。
     * 工号缺失时回退使用 username，显示名缺失时回退使用 username。
     */
    public User provisionSubmitter(String employeeNo, String username, String displayName, String email) {
        String effectiveUsername = StringUtils.hasText(username) ? username.trim()
                : (StringUtils.hasText(employeeNo) ? employeeNo.trim() : null);
        if (effectiveUsername == null) {
            throw new IllegalStateException("SSO 返回的身份缺少工号与用户名，无法建档");
        }
        User user = new User();
        user.setUsername(effectiveUsername);
        user.setEmployeeNo(StringUtils.hasText(employeeNo) ? employeeNo.trim() : effectiveUsername);
        user.setDisplayName(StringUtils.hasText(displayName) ? displayName.trim() : effectiveUsername);
        user.setEmail(StringUtils.hasText(email) ? email.trim() : null);
        user.setRole("SUBMITTER");
        user.setAvatarColor(pickColor(effectiveUsername));
        user.setActive(true);
        userMapper.insert(user);
        log.info("SSO 首次登录自动建档用户: {} ({})", effectiveUsername, user.getEmployeeNo());
        return user;
    }

    /** 按用户名稳定取色（同一用户每次登录颜色不变）。 */
    public static String pickColor(String key) {
        return AVATAR_COLORS.get(Math.floorMod(key.hashCode(), AVATAR_COLORS.size()));
    }
}
