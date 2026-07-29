package com.dts.service;

import com.dts.common.BusinessException;
import com.dts.config.DtsCustomizationProperties;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

/** 统一执行接入配置中的功能开关，避免仅隐藏前端入口。 */
@Service
@RequiredArgsConstructor
public class FeatureGuard {

    private final DtsCustomizationProperties customization;

    public boolean enabled(String key) {
        return customization.getFeatures().getOrDefault(key, true);
    }

    public void requireEnabled(String key, String featureName) {
        if (!enabled(key)) {
            throw new BusinessException(403, featureName + "功能已在接入配置中关闭");
        }
    }
}
