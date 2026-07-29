package com.dts.service;

import com.dts.common.BusinessException;
import com.dts.config.DtsCustomizationProperties;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

class FeatureGuardTest {

    @Test
    void rejectsDisabledFeatureAndAllowsEnabledOrUnspecifiedFeature() {
        DtsCustomizationProperties customization = new DtsCustomizationProperties();
        customization.getFeatures().put("attachments", false);
        customization.getFeatures().put("relations", true);
        FeatureGuard guard = new FeatureGuard(customization);

        BusinessException error = assertThrows(BusinessException.class,
                () -> guard.requireEnabled("attachments", "附件"));
        assertEquals(403, error.getCode());
        assertDoesNotThrow(() -> guard.requireEnabled("relations", "问题关联"));
        assertDoesNotThrow(() -> guard.requireEnabled("unknown", "未知能力"));
    }
}
