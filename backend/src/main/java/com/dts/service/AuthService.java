package com.dts.service;

import com.dts.common.BusinessException;
import com.dts.domain.User;
import com.dts.dto.AuthDtos;
import com.dts.mapper.UserMapper;
import com.baomidou.mybatisplus.core.toolkit.Wrappers;
import com.dts.security.JwtUtil;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Set;

@Service
@RequiredArgsConstructor
public class AuthService {

    private static final Set<String> ROLES = Set.of("SUBMITTER", "DEVELOPER", "LEADER");
    private static final List<String> AVATAR_COLORS =
            List.of("#6366f1", "#0ea5e9", "#10b981", "#f59e0b", "#ec4899", "#8b5cf6", "#ef4444", "#14b8a6");

    private final UserMapper userMapper;
    private final PasswordEncoder passwordEncoder;
    private final JwtUtil jwtUtil;

    @Value("${app.auth.local.enabled}")
    private boolean localLoginEnabled;

    @Transactional
    public AuthDtos.LoginResponse login(AuthDtos.LoginRequest req) {
        if (!localLoginEnabled) {
            throw new BusinessException(403, "系统已接入统一认证，本地账号登录未启用");
        }
        User user = userMapper.selectOne(Wrappers.<User>lambdaQuery()
                .eq(User::getUsername, req.getUsername()));
        if (user == null) {
            throw new BusinessException(401, "用户名或密码错误");
        }
        if (!user.getActive()) {
            throw new BusinessException(403, "账号已被停用");
        }
        if (user.getPassword() == null || !passwordEncoder.matches(req.getPassword(), user.getPassword())) {
            throw new BusinessException(401, "用户名或密码错误");
        }
        String token = jwtUtil.generate(user.getId(), user.getUsername(), user.getDisplayName(),
                user.getRole(), user.getEmployeeNo(), user.getAvatarColor(), user.getSubModuleId());
        return buildResponse(token, user);
    }

    @Transactional
    public AuthDtos.LoginResponse register(AuthDtos.RegisterRequest req) {
        if (!localLoginEnabled) {
            throw new BusinessException(403, "系统已接入统一认证，本地注册未启用");
        }
        if (userMapper.selectCount(Wrappers.<User>lambdaQuery()
                .eq(User::getUsername, req.getUsername())) > 0) {
            throw new BusinessException("用户名已存在");
        }
        if (userMapper.selectCount(Wrappers.<User>lambdaQuery()
                .eq(User::getEmployeeNo, req.getEmployeeNo())) > 0) {
            throw new BusinessException("工号已存在");
        }
        if (!ROLES.contains(req.getRole())) {
            throw new BusinessException("非法角色");
        }
        User user = User.builder()
                .employeeNo(req.getEmployeeNo())
                .username(req.getUsername())
                .displayName(req.getDisplayName())
                .password(passwordEncoder.encode(req.getPassword()))
                .role(req.getRole())
                .email(req.getEmail())
                .phone(req.getPhone())
                .avatarColor(AVATAR_COLORS.get((int) (System.currentTimeMillis() % AVATAR_COLORS.size())))
                .active(true)
                .build();
        userMapper.insert(user);
        String token = jwtUtil.generate(user.getId(), user.getUsername(), user.getDisplayName(),
                user.getRole(), user.getEmployeeNo(), user.getAvatarColor(), user.getSubModuleId());
        return buildResponse(token, user);
    }

    private AuthDtos.LoginResponse buildResponse(String token, User user) {
        AuthDtos.UserVo vo = new AuthDtos.UserVo();
        vo.setId(user.getId());
        vo.setEmployeeNo(user.getEmployeeNo());
        vo.setUsername(user.getUsername());
        vo.setDisplayName(user.getDisplayName());
        vo.setRole(user.getRole());
        vo.setEmail(user.getEmail());
        vo.setPhone(user.getPhone());
        vo.setAvatarColor(user.getAvatarColor());
        vo.setSubModuleId(user.getSubModuleId());
        AuthDtos.LoginResponse resp = new AuthDtos.LoginResponse();
        resp.setToken(token);
        resp.setUser(vo);
        return resp;
    }
}
