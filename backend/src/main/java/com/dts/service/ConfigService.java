package com.dts.service;

import com.dts.common.BusinessException;
import com.dts.domain.*;
import com.dts.repository.*;
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

    private final UserRepository userRepository;
    private final TeamRepository teamRepository;
    private final ProductRepository productRepository;
    private final ModuleRepository moduleRepository;
    private final ProductVersionRepository versionRepository;
    private final IssueDomainRepository domainRepository;

    // ─── 用户/团队 ───
    public List<User> listUsers() {
        return userRepository.findAll();
    }

    public List<User> listDevelopers() {
        return userRepository.findByRoleAndActiveTrue("DEVELOPER");
    }

    public List<Team> listTeams() {
        return teamRepository.findAll();
    }

    @Transactional
    public Team saveTeam(Team team) {
        return teamRepository.save(team);
    }

    @Transactional
    public void deleteTeam(Long id) {
        if (userRepository.findAll().stream().anyMatch(u -> id.equals(u.getTeamId()))) {
            throw new BusinessException("该团队下仍有用户，无法删除");
        }
        teamRepository.deleteById(id);
    }

    // ─── 产品 ───
    public List<Product> listProducts() {
        return productRepository.findByActiveTrue();
    }

    @Transactional
    public Product saveProduct(Product p) {
        return productRepository.save(p);
    }

    @Transactional
    public void deleteProduct(Long id) {
        productRepository.deleteById(id);
    }

    // ─── 模块 ───
    public List<ProductModule> listModules(Long productId) {
        return productId != null ? moduleRepository.findByProductIdAndActiveTrue(productId)
                : moduleRepository.findByActiveTrue();
    }

    @Transactional
    public ProductModule saveModule(ProductModule m) {
        return moduleRepository.save(m);
    }

    @Transactional
    public void deleteModule(Long id) {
        moduleRepository.deleteById(id);
    }

    // ─── 版本 ───
    public List<ProductVersion> listVersions(Long productId) {
        return productId != null ? versionRepository.findByProductIdAndActiveTrue(productId)
                : versionRepository.findByActiveTrue();
    }

    @Transactional
    public ProductVersion saveVersion(ProductVersion v) {
        return versionRepository.save(v);
    }

    @Transactional
    public void deleteVersion(Long id) {
        versionRepository.deleteById(id);
    }

    // ─── 问题领域 ───
    public List<IssueDomain> listDomains() {
        return domainRepository.findAll();
    }

    @Transactional
    public IssueDomain saveDomain(IssueDomain d) {
        return domainRepository.save(d);
    }

    @Transactional
    public void deleteDomain(Long id) {
        domainRepository.deleteById(id);
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
                "domains", listDomains());
    }
}
