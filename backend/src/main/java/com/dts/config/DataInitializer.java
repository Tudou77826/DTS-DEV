package com.dts.config;

import com.dts.domain.*;
import com.dts.mapper.*;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.CommandLineRunner;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;

import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Set;

/**
 * 启动时把接入配置中的组织、人员和业务主数据同步到运行库。
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class DataInitializer implements CommandLineRunner {

    private final UserMapper userMapper;
    private final TeamMapper teamMapper;
    private final ModuleMapper moduleMapper;
    private final ProductMapper productMapper;
    private final ProductVersionMapper versionMapper;
    private final SubModuleMapper subModuleMapper;
    private final IssueDomainMapper domainMapper;
    private final PasswordEncoder passwordEncoder;
    private final DtsCustomizationProperties customization;

    @Value("${app.bootstrap.default-user-password}")
    private String defaultUserPassword;

    @Override
    public void run(String... args) {
        syncOrganization();
        syncIssueFormOptions();
    }

    /**
     * 团队与人员以接入配置为来源。重启时按稳定 key/username 合并，
     * 已有账号的密码不会被配置同步覆盖。
     */
    private void syncOrganization() {
        // 先同步子模块字典（用户归属引用子模块名称），并按同名模块挂载所属模块
        Map<String, Long> subModuleIds = new LinkedHashMap<>();
        for (String name : customization.getMasterData().getSubModules()) {
            SubModule existing = subModuleMapper.selectOne(com.baomidou.mybatisplus.core.toolkit.Wrappers
                    .<SubModule>lambdaQuery()
                    .eq(SubModule::getName, name).last("LIMIT 1"));
            // 同名模块（子模块确定后所属模块随之确定）
            ProductModule module = moduleMapper.selectOne(com.baomidou.mybatisplus.core.toolkit.Wrappers
                    .<ProductModule>lambdaQuery()
                    .eq(ProductModule::getName, name)
                    .eq(ProductModule::getActive, true).last("LIMIT 1"));
            Long moduleId = module == null ? null : module.getId();
            if (existing == null) {
                existing = insert(subModuleMapper, SubModule.builder()
                        .name(name).moduleId(moduleId).active(true).build());
            } else if (moduleId != null && !java.util.Objects.equals(existing.getModuleId(), moduleId)) {
                existing.setModuleId(moduleId);
                subModuleMapper.updateById(existing);
            }
            subModuleIds.put(name, existing.getId());
        }

        Map<String, Long> teamIds = new LinkedHashMap<>();
        for (DtsCustomizationProperties.TeamOption configured : customization.getMasterData().getTeams()) {
            Team team = teamMapper.selectOne(com.baomidou.mybatisplus.core.toolkit.Wrappers.<Team>lambdaQuery()
                    .eq(Team::getName, configured.getName()).last("LIMIT 1"));
            if (team == null) {
                team = insert(teamMapper, Team.builder()
                        .name(configured.getName())
                        .description(configured.getDescription())
                        .build());
            } else if (!java.util.Objects.equals(team.getDescription(), configured.getDescription())) {
                team.setDescription(configured.getDescription());
                teamMapper.updateById(team);
            }
            teamIds.put(configured.getKey(), team.getId());
        }

        int created = 0;
        int updated = 0;
        for (DtsCustomizationProperties.UserOption configured : customization.getMasterData().getUsers()) {
            // 接入配置只用于维护具备处理/被指定权限的人员（负责人、开发人员），
            // 普通提出人由统一认证首次登录时自动建档，不在配置中维护。
            if (!Set.of("DEVELOPER", "LEADER").contains(configured.getRole())) {
                log.warn("跳过接入配置中的用户 {}：角色 {} 不可配置（仅支持 DEVELOPER / LEADER）",
                        configured.getUsername(), configured.getRole());
                continue;
            }
            User user = userMapper.selectOne(com.baomidou.mybatisplus.core.toolkit.Wrappers.<User>lambdaQuery()
                    .eq(User::getUsername, configured.getUsername()).last("LIMIT 1"));
            boolean isNew = user == null;
            if (isNew) {
                user = new User();
                user.setUsername(configured.getUsername());
                user.setPassword(passwordEncoder.encode(defaultUserPassword));
            }
            user.setEmployeeNo(configured.getEmployeeNo());
            user.setDisplayName(configured.getDisplayName());
            user.setRole(configured.getRole());
            user.setTeamId(teamIds.get(configured.getTeam()));
            user.setSubModuleId(subModuleIds.get(configured.getSubModule()));
            user.setAvatarColor(configured.getAvatarColor());
            user.setActive(configured.isActive());
            if (isNew) {
                userMapper.insert(user);
                created++;
            } else {
                userMapper.updateById(user);
                updated++;
            }
        }
        log.info("已从接入配置同步组织人员: 团队 {} 个，新增用户 {} 个，更新用户 {} 个",
                teamIds.size(), created, updated);
    }

    /**
     * 以“合并”方式加载表单配置：配置文件可新增或更新默认字典，
     * 不删除管理员在页面中维护的其他数据。
     */
    private void syncIssueFormOptions() {
        for (String moduleName : customization.getMasterData().getModules()) {
            if (moduleMapper.selectCount(com.baomidou.mybatisplus.core.toolkit.Wrappers
                    .<ProductModule>lambdaQuery()
                    .eq(ProductModule::getName, moduleName)) == 0) {
                insert(moduleMapper, ProductModule.builder()
                        .name(moduleName).active(true).build());
            }
        }
        for (String productName : customization.getMasterData().getProducts()) {
            if (productMapper.selectCount(com.baomidou.mybatisplus.core.toolkit.Wrappers
                    .<Product>lambdaQuery()
                    .eq(Product::getName, productName)) == 0) {
                insert(productMapper, Product.builder()
                        .name(productName).active(true).build());
            }
        }
        for (String version : customization.getMasterData().getVersions()) {
            if (versionMapper.selectCount(com.baomidou.mybatisplus.core.toolkit.Wrappers
                    .<ProductVersion>lambdaQuery()
                    .eq(ProductVersion::getVersion, version)) == 0) {
                insert(versionMapper, ProductVersion.builder()
                        .version(version).active(true).build());
            }
        }
        for (DtsCustomizationProperties.DomainOption configured : customization.getMasterData().getDomains()) {
            IssueDomain domain = domainMapper.selectOne(
                    com.baomidou.mybatisplus.core.toolkit.Wrappers.<IssueDomain>lambdaQuery()
                            .eq(IssueDomain::getName, configured.getName()).last("LIMIT 1"));
            if (domain == null) {
                insert(domainMapper, IssueDomain.builder()
                        .name(configured.getName()).description(configured.getDescription()).build());
            } else if (!java.util.Objects.equals(domain.getDescription(), configured.getDescription())) {
                domain.setDescription(configured.getDescription());
                domainMapper.updateById(domain);
            }
        }
        log.info("已加载接入配置 {}，主数据同步模式: {}",
                customization.getProfile().getId(), customization.getMasterData().getSyncMode());
    }

    private <T extends BaseEntity> T insert(com.baomidou.mybatisplus.core.mapper.BaseMapper<T> mapper, T entity) {
        mapper.insert(entity);
        return entity;
    }
}
