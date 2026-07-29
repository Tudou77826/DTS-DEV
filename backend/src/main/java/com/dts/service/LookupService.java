package com.dts.service;

import com.dts.domain.*;
import com.dts.repository.*;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.*;
import java.util.stream.Collectors;

/**
 * 名称解析服务：批量把实体 ID 转成名称，供 DTO 组装时减少 N+1 查询。
 */
@Service
@RequiredArgsConstructor
public class LookupService {

    private final UserRepository userRepository;
    private final ProductRepository productRepository;
    private final ModuleRepository moduleRepository;
    private final ProductVersionRepository versionRepository;
    private final IssueDomainRepository domainRepository;
    private final TeamRepository teamRepository;

    public Map<Long, String> userNames(Collection<Long> ids) {
        if (ids == null || ids.isEmpty()) return Map.of();
        return userRepository.findAllById(ids).stream()
                .collect(Collectors.toMap(User::getId, User::getDisplayName));
    }

    public String userName(Long id) {
        if (id == null) return null;
        return userRepository.findById(id).map(User::getDisplayName).orElse(null);
    }

    public Map<Long, String> versionNames(Collection<Long> ids) {
        if (ids == null || ids.isEmpty()) return Map.of();
        return versionRepository.findAllById(ids).stream()
                .collect(Collectors.toMap(ProductVersion::getId, ProductVersion::getVersion));
    }

    public String versionName(Long id) {
        if (id == null) return null;
        return versionRepository.findById(id).map(ProductVersion::getVersion).orElse(null);
    }

    public Map<Long, String> productNames(Collection<Long> ids) {
        if (ids == null || ids.isEmpty()) return Map.of();
        return productRepository.findAllById(ids).stream()
                .collect(Collectors.toMap(Product::getId, Product::getName));
    }

    public String productName(Long id) {
        if (id == null) return null;
        return productRepository.findById(id).map(Product::getName).orElse(null);
    }

    public Map<Long, String> moduleNames(Collection<Long> ids) {
        if (ids == null || ids.isEmpty()) return Map.of();
        return moduleRepository.findAllById(ids).stream()
                .collect(Collectors.toMap(ProductModule::getId, ProductModule::getName));
    }

    public String moduleName(Long id) {
        if (id == null) return null;
        return moduleRepository.findById(id).map(ProductModule::getName).orElse(null);
    }

    public String domainName(Long id) {
        if (id == null) return null;
        return domainRepository.findById(id).map(IssueDomain::getName).orElse(null);
    }
}
