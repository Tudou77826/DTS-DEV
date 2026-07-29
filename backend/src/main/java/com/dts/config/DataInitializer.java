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

/**
 * 启动时把接入配置中的组织、人员和业务主数据同步到运行库。
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class DataInitializer implements CommandLineRunner {

    private final UserMapper userMapper;
    private final TeamMapper teamMapper;
    private final ProductMapper productMapper;
    private final ModuleMapper moduleMapper;
    private final ProductVersionMapper versionMapper;
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
        for (DtsCustomizationProperties.ProductOption configured : customization.getMasterData().getProducts()) {
            Product product = productMapper.selectOne(
                    com.baomidou.mybatisplus.core.toolkit.Wrappers.<Product>lambdaQuery()
                            .eq(Product::getName, configured.getName()).last("LIMIT 1"));
            if (product == null) {
                product = insert(productMapper, Product.builder()
                        .name(configured.getName())
                        .description(configured.getDescription())
                        .active(true)
                        .build());
            } else {
                product.setDescription(configured.getDescription());
                product.setActive(true);
                productMapper.updateById(product);
            }
            final Long productId = product.getId();
            for (String moduleName : configured.getModules()) {
                if (moduleMapper.selectCount(com.baomidou.mybatisplus.core.toolkit.Wrappers
                        .<ProductModule>lambdaQuery()
                        .eq(ProductModule::getProductId, productId)
                        .eq(ProductModule::getName, moduleName)) == 0) {
                    insert(moduleMapper, ProductModule.builder()
                            .productId(productId).name(moduleName).active(true).build());
                }
            }
            for (String versionName : configured.getVersions()) {
                if (versionMapper.selectCount(com.baomidou.mybatisplus.core.toolkit.Wrappers
                        .<ProductVersion>lambdaQuery()
                        .eq(ProductVersion::getProductId, productId)
                        .eq(ProductVersion::getVersion, versionName)) == 0) {
                    insert(versionMapper, ProductVersion.builder()
                            .productId(productId).version(versionName).active(true).build());
                }
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
