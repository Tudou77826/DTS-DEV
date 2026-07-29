package com.dts.security;

import com.dts.common.BusinessException;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;

/**
 * 从安全上下文获取当前登录用户的快捷工具。
 */
public final class SecurityUtil {

    private SecurityUtil() {}

    public static LoginUser current() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth == null || !(auth.getPrincipal() instanceof LoginUser user)) {
            throw new BusinessException(401, "未登录");
        }
        return user;
    }

    public static Long currentUserId() {
        return current().getId();
    }

    public static LoginUser currentOrNull() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth != null && auth.getPrincipal() instanceof LoginUser user) {
            return user;
        }
        return null;
    }
}
