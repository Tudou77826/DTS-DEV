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

import java.util.ArrayList;
import java.util.List;
import java.util.Map;

/**
 * 基础配置（字典）服务：用户/团队/产品/模块/版本/领域。
 *
 * <p>字典改动即时生效，并同步写回接入配置（master-data），保证重启后数据一致。</p>
 */
@Service
@RequiredArgsConstructor
public class ConfigService {

    private final UserMapper userMapper;
    private final TeamMapper teamMapper;
    private final ProductMapper productMapper;
    private final ModuleMapper moduleMapper;
    private final ProductVersionMapper versionMapper;
    private final SubModuleMapper subModuleMapper;
    private final IssueDomainMapper domainMapper;
    private final DtsCustomizationProperties customization;
    private final CustomizationAdminService customizationAdminService;

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
        // 同名产品被“重启覆盖”停用后重新添加时，直接恢复启用而不是插入（名称唯一）
        if (p.getId() == null) {
            Product existing = productMapper.selectOne(Wrappers.<Product>lambdaQuery()
                    .eq(Product::getName, p.getName()).last("LIMIT 1"));
            if (existing != null) {
                existing.setActive(true);
                if (p.getDescription() != null) existing.setDescription(p.getDescription());
                productMapper.updateById(existing);
                syncMasterData();
                return existing;
            }
        }
        Product saved = save(productMapper, p);
        syncMasterData();
        return saved;
    }

    @Transactional
    public void deleteProduct(Long id) {
        productMapper.deleteById(id);
        syncMasterData();
    }

    // ─── 模块 ───
    public List<ProductModule> listModules(Long productId) {
        return moduleMapper.selectList(Wrappers.<ProductModule>lambdaQuery()
                .eq(productId != null, ProductModule::getProductId, productId)
                .eq(ProductModule::getActive, true));
    }

    @Transactional
    public ProductModule saveModule(ProductModule m) {
        ProductModule saved = save(moduleMapper, m);
        syncMasterData();
        return saved;
    }

    @Transactional
    public void deleteModule(Long id) {
        moduleMapper.deleteById(id);
        syncMasterData();
    }

    // ─── 版本 ───
    public List<ProductVersion> listVersions(Long productId) {
        return versionMapper.selectList(Wrappers.<ProductVersion>lambdaQuery()
                .eq(productId != null, ProductVersion::getProductId, productId)
                .eq(ProductVersion::getActive, true));
    }

    @Transactional
    public ProductVersion saveVersion(ProductVersion v) {
        ProductVersion saved = save(versionMapper, v);
        syncMasterData();
        return saved;
    }

    @Transactional
    public void deleteVersion(Long id) {
        versionMapper.deleteById(id);
        syncMasterData();
    }

    // ─── 问题领域 ───
    public List<IssueDomain> listDomains() {
        return domainMapper.selectList(Wrappers.<IssueDomain>lambdaQuery()
                .eq(IssueDomain::getActive, true)
                .orderByAsc(IssueDomain::getId));
    }

    @Transactional
    public IssueDomain saveDomain(IssueDomain d) {
        // 同名领域被停用后重新添加时恢复启用（名称唯一）
        if (d.getId() == null) {
            IssueDomain existing = domainMapper.selectOne(Wrappers.<IssueDomain>lambdaQuery()
                    .eq(IssueDomain::getName, d.getName()).last("LIMIT 1"));
            if (existing != null) {
                existing.setActive(true);
                if (d.getDescription() != null) existing.setDescription(d.getDescription());
                domainMapper.updateById(existing);
                syncMasterData();
                return existing;
            }
        }
        IssueDomain saved = save(domainMapper, d);
        syncMasterData();
        return saved;
    }

    @Transactional
    public void deleteDomain(Long id) {
        domainMapper.deleteById(id);
        syncMasterData();
    }

    // ─── 子模块 ───
    public List<SubModule> listSubModules() {
        return subModuleMapper.selectList(Wrappers.<SubModule>lambdaQuery()
                .eq(SubModule::getActive, true)
                .orderByAsc(SubModule::getId));
    }

    @Transactional
    public SubModule saveSubModule(SubModule sub) {
        if (sub.getId() == null) {
            SubModule existing = subModuleMapper.selectOne(Wrappers.<SubModule>lambdaQuery()
                    .eq(SubModule::getName, sub.getName()).last("LIMIT 1"));
            if (existing != null) {
                existing.setActive(true);
                subModuleMapper.updateById(existing);
                syncMasterData();
                return existing;
            }
        }
        SubModule saved = save(subModuleMapper, sub);
        syncMasterData();
        return saved;
    }

    @Transactional
    public void deleteSubModule(Long id) {
        subModuleMapper.deleteById(id);
        syncMasterData();
    }

    /**
     * 一次性返回前端筛选用到的所有字典（减少请求次数）。
     */
    public Map<String, Object> allDictionaries() {
        return Map.of(
                "users", listUsers(),
                "developers", listDevelopers(),
                "teams", listTeams(),
                "products", listProducts(),
                "modules", listModules(null),
                "versions", listVersions(null),
                "subModules", listSubModules(),
                "domains", listDomains(),
                "customization", customization);
    }

    /**
     * 字典即时编辑后把当前库中的主数据写回接入配置（master-data），
     * 这样「即时生效」的改动在重启后依然成立，不会被覆盖回滚。
     */
    private void syncMasterData() {
        CustomizationAdminService.MasterDataPatch patch = new CustomizationAdminService.MasterDataPatch();
        patch.setProducts(listProducts().stream().map(Product::getName).toList());
        patch.setVersions(listVersions(null).stream().map(ProductVersion::getVersion).toList());
        patch.setModules(listModules(null).stream().map(ProductModule::getName).toList());
        patch.setSubModules(listSubModules().stream().map(SubModule::getName).toList());
        List<DtsCustomizationProperties.DomainOption> domains = new ArrayList<>();
        for (IssueDomain domain : listDomains()) {
            DtsCustomizationProperties.DomainOption option = new DtsCustomizationProperties.DomainOption();
            option.setName(domain.getName());
            option.setDescription(domain.getDescription());
            domains.add(option);
        }
        patch.setDomains(domains);
        customizationAdminService.updateMasterData(patch);
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
