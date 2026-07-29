package com.dts.service;

import com.dts.common.BusinessException;
import com.dts.domain.*;
import com.dts.mapper.*;
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

    private final UserMapper userMapper;
    private final ProductMapper productMapper;
    private final ModuleMapper moduleMapper;
    private final ProductVersionMapper versionMapper;
    private final IssueDomainMapper domainMapper;

    public Map<Long, String> userNames(Collection<Long> ids) {
        if (ids == null || ids.isEmpty()) return Map.of();
        return userMapper.selectByIds(ids).stream()
                .collect(Collectors.toMap(User::getId, User::getDisplayName));
    }

    public String userName(Long id) {
        if (id == null) return null;
        User user = userMapper.selectById(id);
        return user == null ? null : user.getDisplayName();
    }

    public User requireAssignableUser(Long id) {
        User user = id == null ? null : userMapper.selectById(id);
        if (user == null || !Boolean.TRUE.equals(user.getActive()) || !"DEVELOPER".equals(user.getRole())) {
            throw new BusinessException("责任人必须是启用的开发人员");
        }
        return user;
    }

    public Map<Long, String> versionNames(Collection<Long> ids) {
        if (ids == null || ids.isEmpty()) return Map.of();
        return versionMapper.selectByIds(ids).stream()
                .collect(Collectors.toMap(ProductVersion::getId, ProductVersion::getVersion));
    }

    public String versionName(Long id) {
        if (id == null) return null;
        ProductVersion version = versionMapper.selectById(id);
        return version == null ? null : version.getVersion();
    }

    public Map<Long, String> productNames(Collection<Long> ids) {
        if (ids == null || ids.isEmpty()) return Map.of();
        return productMapper.selectByIds(ids).stream()
                .collect(Collectors.toMap(Product::getId, Product::getName));
    }

    public String productName(Long id) {
        if (id == null) return null;
        Product product = productMapper.selectById(id);
        return product == null ? null : product.getName();
    }

    public Map<Long, String> moduleNames(Collection<Long> ids) {
        if (ids == null || ids.isEmpty()) return Map.of();
        return moduleMapper.selectByIds(ids).stream()
                .collect(Collectors.toMap(ProductModule::getId, ProductModule::getName));
    }

    public String moduleName(Long id) {
        if (id == null) return null;
        ProductModule module = moduleMapper.selectById(id);
        return module == null ? null : module.getName();
    }

    public String domainName(Long id) {
        if (id == null) return null;
        IssueDomain domain = domainMapper.selectById(id);
        return domain == null ? null : domain.getName();
    }
}
