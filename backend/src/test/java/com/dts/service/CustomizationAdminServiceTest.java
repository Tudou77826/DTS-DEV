package com.dts.service;

import com.dts.config.DtsCustomizationProperties;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import org.springframework.test.util.ReflectionTestUtils;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * 接入配置 YAML 读写闭环测试：
 * 1. 主数据即时编辑会写回 YAML，且不破坏品牌/管理员等其他节点；
 * 2. 结构化表单保存时保留 YAML 中当前的主数据（不被旧快照覆盖）。
 */
class CustomizationAdminServiceTest {

    @TempDir
    Path tempDir;

    private CustomizationAdminService service;

    @BeforeEach
    void setUp() throws IOException {
        // 以真实 classpath 默认配置为起点，拷贝到临时外部配置路径
        String classpathYml = new String(
                new org.springframework.core.io.ClassPathResource("dts-customization.yml")
                        .getInputStream().readAllBytes(), StandardCharsets.UTF_8);
        Path external = tempDir.resolve("dts-customization.yml");
        Files.writeString(external, classpathYml);

        service = new CustomizationAdminService(new ObjectMapper(), new DtsCustomizationProperties());
        ReflectionTestUtils.setField(service, "externalFile", external.toString());
    }

    private String readFile() throws IOException {
        return Files.readString(tempDir.resolve("dts-customization.yml"), StandardCharsets.UTF_8);
    }

    @Test
    void updateMasterDataWritesBackAndPreservesOtherSections() throws IOException {
        CustomizationAdminService.MasterDataPatch patch = new CustomizationAdminService.MasterDataPatch();
        patch.setProducts(List.of("P1"));
        patch.setVersions(List.of("V1"));
        patch.setModules(List.of("M1"));
        patch.setSubModules(List.of("S1"));
        DtsCustomizationProperties.DomainOption domain = new DtsCustomizationProperties.DomainOption();
        domain.setName("D1");
        patch.setDomains(List.of(domain));

        service.updateMasterData(patch);

        String content = readFile();
        assertTrue(content.contains("- P1"), "主数据产品应写回 YAML");
        assertTrue(content.contains("- V1"));
        assertTrue(content.contains("- M1"));
        assertTrue(content.contains("- S1"));
        assertTrue(content.contains("name: D1"));
        // 其他节点原样保留
        assertTrue(content.contains("问题管理平台"), "品牌节点应保留");
        assertTrue(content.contains("password-hash"), "管理员密码哈希应保留");
        assertTrue(content.contains("network-security"), "组织人员应保留");
    }

    @Test
    void saveStructuredKeepsCurrentMasterDataNotDraftSnapshot() throws IOException {
        // 表单草稿里放了过期的主数据快照，保存时不应覆盖 YAML 中当前的主数据
        DtsCustomizationProperties draft = service.readStructured().getCustomization();
        draft.getMasterData().setProducts(List.of("过期的快照产品"));
        draft.getBranding().setProductName("新的品牌名");

        service.saveStructured(draft);

        String content = readFile();
        assertTrue(content.contains("新的品牌名"), "品牌修改应生效");
        assertFalse(content.contains("过期的快照产品"), "不应写回草稿中的旧主数据快照");
        assertTrue(content.contains("态势感知"), "应保留 YAML 当前的主数据");
    }
}
