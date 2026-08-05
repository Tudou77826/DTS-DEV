package com.dts.security;

import lombok.AllArgsConstructor;
import lombok.Getter;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.userdetails.UserDetails;

import java.util.Collection;
import java.util.List;

/**
 * 安全上下文中的登录用户。
 */
@Getter
@AllArgsConstructor
public class LoginUser implements UserDetails {

    private final Long id;
    private final String username;
    private final String displayName;
    private final String role; // SUBMITTER / DEVELOPER / LEADER
    private final String employeeNo;
    private final String avatarColor;

    @Override
    public Collection<? extends GrantedAuthority> getAuthorities() {
        return List.of(new SimpleGrantedAuthority("ROLE_" + role));
    }

    @Override
    public String getPassword() {
        return "";
    }

    public boolean isLeader() {
        return "LEADER".equals(role);
    }
}
