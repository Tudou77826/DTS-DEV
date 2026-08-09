package com.dts.config;

import com.dts.domain.*;
import com.dts.mapper.*;
import com.baomidou.mybatisplus.core.toolkit.Wrappers;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.CommandLineRunner;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;

/**
 * 启动时把接入配置中的组织、人员和业务主数据同步到运行库。
 *
 * <p>同步口径：组织（团队/人员）以接入配置为权威来源按稳定 key 合并；
 * 业务主数据（产品/版本/模块/子模块/问题领域）为“重启覆盖”——接入配置中缺失的字典会被停用，
 * 因为管理员页面即时编辑时会写回接入配置，两份数据始终一致。</p>
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
        List<String> subModuleNames = customization.getMasterData().getSubModules();
        Map<String, Long> subModuleIds = new LinkedHashMap<>();
        for (String name : subModuleNames) {
            SubModule existing = subModuleMapper.selectOne(Wrappers
                    .<SubModule>lambdaQuery()
                    .eq(SubModule::getName, name).last("LIMIT 1"));
            // 同名模块（子模块确定后所属模块随之确定）
            ProductModule module = moduleMapper.selectOne(Wrappers
                    .<ProductModule>lambdaQuery()
                    .eq(ProductModule::getName, name)
                    .eq(ProductModule::getActive, true).last("LIMIT 1"));
            Long moduleId = module == null ? null : module.getId();
            if (existing == null) {
                existing = insert(subModuleMapper, SubModule.builder()
                        .name(name).moduleId(moduleId).active(true).build());
            } else {
                boolean changed = !Boolean.TRUE.equals(existing.getActive());
                if (moduleId != null && !java.util.Objects.equals(existing.getModuleId(), moduleId)) {
                    existing.setModuleId(moduleId);
                    changed = true;
                }
                if (changed) {
                    existing.setActive(true);
                    subModuleMapper.updateById(existing);
                }
            }
            subModuleIds.put(name, existing.getId());
        }
        // 重启覆盖：接入配置中不存在的子模块停用（保留历史问题归属，不再出现在下拉中）
        if (!subModuleNames.isEmpty()) {
            subModuleMapper.update(null, Wrappers.<SubModule>lambdaUpdate()
                    .set(SubModule::getActive, false)
                    .eq(SubModule::getActive, true)
                    .notIn(SubModule::getName, subModuleNames));
        }

        Map<String, Long> teamIds = new LinkedHashMap<>();
        for (DtsCustomizationProperties.TeamOption configured : customization.getMasterData().getTeams()) {
            Team team = teamMapper.selectOne(Wrappers.<Team>lambdaQuery()
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
            User user = userMapper.selectOne(Wrappers.<User>lambdaQuery()
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
     * 业务主数据（产品/版本/模块/问题领域）以接入配置为权威来源，重启覆盖：
     * 接入配置中存在的字典确保启用，缺失的字典停用。
     * 管理员页面即时编辑字典时会写回接入配置，因此两份数据始终一致。
     */
    private void syncIssueFormOptions() {
        List<String> moduleNames = customization.getMasterData().getModules();
        for (String moduleName : moduleNames) {
            ProductModule module = moduleMapper.selectOne(Wrappers.<ProductModule>lambdaQuery()
                    .eq(ProductModule::getName, moduleName).last("LIMIT 1"));
            if (module == null) {
                insert(moduleMapper, ProductModule.builder().name(moduleName).active(true).build());
            } else if (!Boolean.TRUE.equals(module.getActive())) {
                module.setActive(true);
                moduleMapper.updateById(module);
            }
        }
        if (!moduleNames.isEmpty()) {
            moduleMapper.update(null, Wrappers.<ProductModule>lambdaUpdate()
                    .set(ProductModule::getActive, false)
                    .eq(ProductModule::getActive, true)
                    .notIn(ProductModule::getName, moduleNames));
        }

        List<String> productNames = customization.getMasterData().getProducts();
        for (String productName : productNames) {
            Product product = productMapper.selectOne(Wrappers.<Product>lambdaQuery()
                    .eq(Product::getName, productName).last("LIMIT 1"));
            if (product == null) {
                insert(productMapper, Product.builder().name(productName).active(true).build());
            } else if (!Boolean.TRUE.equals(product.getActive())) {
                product.setActive(true);
                productMapper.updateById(product);
            }
        }
        if (!productNames.isEmpty()) {
            productMapper.update(null, Wrappers.<Product>lambdaUpdate()
                    .set(Product::getActive, false)
                    .eq(Product::getActive, true)
                    .notIn(Product::getName, productNames));
        }

        List<String> versionList = customization.getMasterData().getVersions();
        for (String version : versionList) {
            ProductVersion existing = versionMapper.selectOne(Wrappers.<ProductVersion>lambdaQuery()
                    .eq(ProductVersion::getVersion, version).last("LIMIT 1"));
            if (existing == null) {
                insert(versionMapper, ProductVersion.builder().version(version).active(true).build());
            } else if (!Boolean.TRUE.equals(existing.getActive())) {
                existing.setActive(true);
                versionMapper.updateById(existing);
            }
        }
        if (!versionList.isEmpty()) {
            versionMapper.update(null, Wrappers.<ProductVersion>lambdaUpdate()
                    .set(ProductVersion::getActive, false)
                    .eq(ProductVersion::getActive, true)
                    .notIn(ProductVersion::getVersion, versionList));
        }

        List<String> domainNames = customization.getMasterData().getDomains().stream()
                .map(DtsCustomizationProperties.DomainOption::getName).toList();
        for (DtsCustomizationProperties.DomainOption configured : customization.getMasterData().getDomains()) {
            IssueDomain domain = domainMapper.selectOne(Wrappers.<IssueDomain>lambdaQuery()
                    .eq(IssueDomain::getName, configured.getName()).last("LIMIT 1"));
            if (domain == null) {
                insert(domainMapper, IssueDomain.builder()
                        .name(configured.getName()).description(configured.getDescription()).active(true).build());
            } else {
                boolean changed = !Boolean.TRUE.equals(domain.getActive());
                if (configured.getDescription() != null
                        && !java.util.Objects.equals(domain.getDescription(), configured.getDescription())) {
                    domain.setDescription(configured.getDescription());
                    changed = true;
                }
                if (changed) {
                    domain.setActive(true);
                    domainMapper.updateById(domain);
                }
            }
        }
        if (!domainNames.isEmpty()) {
            domainMapper.update(null, Wrappers.<IssueDomain>lambdaUpdate()
                    .set(IssueDomain::getActive, false)
                    .eq(IssueDomain::getActive, true)
                    .notIn(IssueDomain::getName, domainNames));
        }

        log.info("已加载接入配置 {}，主数据同步模式: {}",
                customization.getProfile().getId(), customization.getMasterData().getSyncMode());
    }

    private <T extends BaseEntity> T insert(com.baomidou.mybatisplus.core.mapper.BaseMapper<T> mapper, T entity) {
        mapper.insert(entity);
        return entity;
    }
}
