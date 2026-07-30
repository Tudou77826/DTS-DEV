package com.dts.service;

import com.dts.common.BusinessException;
import com.dts.domain.*;
import com.dts.config.DtsCustomizationProperties;
import com.dts.mapper.*;
import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.baomidou.mybatisplus.core.toolkit.Wrappers;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Map;

/**
 * 基础配置（字典）服务：用户/团队/产品/模块/版本/领域。
 */
@Service
@RequiredArgsConstructor
public class ConfigService {

    private final UserMapper userMapper;
    private final TeamMapper teamMapper;
    private final ProductMapper productMapper;
    private final ModuleMapper moduleMapper;
    private final ProductVersionMapper versionMapper;
    private final IssueDomainMapper domainMapper;
    private final DtsCustomizationProperties customization;

    // ─── 用户/团队 ───
    public List<User> listUsers() {
        return userMapper.selectList(null);
    }

    public List<User> listDevelopers() {
        return userMapper.selectList(Wrappers.<User>lambdaQuery()
                .eq(User::getRole, "DEVELOPER")
                .eq(User::getActive, true));
    }

    public List<Team> listTeams() {
        return teamMapper.selectList(null);
    }

    @Transactional
    public Team saveTeam(Team team) {
        return save(teamMapper, team);
    }

    @Transactional
    public void deleteTeam(Long id) {
        if (userMapper.selectCount(Wrappers.<User>lambdaQuery().eq(User::getTeamId, id)) > 0) {
            throw new BusinessException("该团队下仍有用户，无法删除");
        }
        teamMapper.deleteById(id);
    }

    // ─── 产品 ───
    public List<Product> listProducts() {
        return productMapper.selectList(Wrappers.<Product>lambdaQuery().eq(Product::getActive, true));
    }

    @Transactional
    public Product saveProduct(Product p) {
        return save(productMapper, p);
    }

    @Transactional
    public void deleteProduct(Long id) {
        productMapper.deleteById(id);
    }

    // ─── 模块 ───
    public List<ProductModule> listModules(Long productId) {
        return moduleMapper.selectList(Wrappers.<ProductModule>lambdaQuery()
                .eq(productId != null, ProductModule::getProductId, productId)
                .eq(ProductModule::getActive, true));
    }

    @Transactional
    public ProductModule saveModule(ProductModule m) {
        return save(moduleMapper, m);
    }

    @Transactional
    public void deleteModule(Long id) {
        moduleMapper.deleteById(id);
    }

    // ─── 版本 ───
    public List<ProductVersion> listVersions(Long productId) {
        return versionMapper.selectList(Wrappers.<ProductVersion>lambdaQuery()
                .eq(productId != null, ProductVersion::getProductId, productId)
                .eq(ProductVersion::getActive, true));
    }

    @Transactional
    public ProductVersion saveVersion(ProductVersion v) {
        return save(versionMapper, v);
    }

    @Transactional
    public void deleteVersion(Long id) {
        versionMapper.deleteById(id);
    }

    // ─── 问题领域 ───
    public List<IssueDomain> listDomains() {
        return domainMapper.selectList(null);
    }

    @Transactional
    public IssueDomain saveDomain(IssueDomain d) {
        return save(domainMapper, d);
    }

    @Transactional
    public void deleteDomain(Long id) {
        domainMapper.deleteById(id);
    }

    /**
     * 一次性返回前端筛选用到的所有字典（减少请求次数）。
     */
    public Map<String, Object> allDictionaries() {
        return Map.of(
                "users", listUsers(),
                "developers", listDevelopers(),
                "teams", listTeams(),
                "modules", listModules(null),
                "domains", listDomains(),
                "customization", customization);
    }

    private <T extends BaseEntity> T save(BaseMapper<T> mapper, T entity) {
        if (entity.getId() == null) {
            mapper.insert(entity);
        } else if (mapper.updateById(entity) == 0) {
            throw new BusinessException("记录不存在: " + entity.getId());
        }
        return entity;
    }
}
