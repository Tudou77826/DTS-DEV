package com.dts.it;

import com.fasterxml.jackson.databind.JsonNode;
import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MvcResult;

import java.nio.file.Files;
import java.nio.file.Path;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * 主数据（字典）集成测试：
 * 1. 字典写入需要管理员令牌（会修改配置文件）；
 * 2. 管理员增删字典即时生效，且写回接入配置 YAML；
 * 3. 普通用户读取字典不受限。
 */
class MasterDataIT extends IssueFlowIT {

    private String leaderToken() throws Exception {
        return login("leader", "123456");
    }

    @Test
    void writeRequiresAdminToken() throws Exception {
        // 普通用户（leader 无管理员令牌）写字典 → 403
        mvc.perform(post("/config/products")
                        .header("X-Auth-Token", leaderToken())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"name\":\"越权产品\",\"active\":true}"))
                .andExpect(status().isForbidden());
    }

    @Test
    void adminAddAndDeleteWritesBackToYaml() throws Exception {
        String leader = leaderToken();
        String marker = "IT-Product-" + System.currentTimeMillis();

        // 管理员新增产品
        JsonNode created = adminJson("POST", "/config/products", leader,
                "{\"name\":\"" + marker + "\",\"active\":true}");
        assertTrue(created.get("data").get("id").asLong() > 0, "管理员应能新增产品");

        // 即时生效：普通用户字典可见
        JsonNode dict = getJson("/config/dictionaries", leader);
        long newId = 0;
        for (JsonNode product : dict.get("data").get("products")) {
            if (marker.equals(product.get("name").asText())) newId = product.get("id").asLong();
        }
        assertTrue(newId > 0, "新增产品应即时出现在字典中");

        // 写回 YAML：配置文件中应包含该产品
        JsonNode fileView = adminGet("/config/customization/admin", leader);
        assertTrue(fileView.get("data").get("content").asText().contains(marker),
                "新增产品应写回接入配置 YAML");

        // 管理员删除 → 字典与 YAML 同步消失
        adminJson("DELETE", "/config/products/" + newId, leader, null);
        JsonNode dict2 = getJson("/config/dictionaries", leader);
        for (JsonNode product : dict2.get("data").get("products")) {
            assertFalse(marker.equals(product.get("name").asText()), "删除后不应再出现");
        }
        JsonNode fileView2 = adminGet("/config/customization/admin", leader);
        assertFalse(fileView2.get("data").get("content").asText().contains(marker),
                "删除应同步 YAML");
    }

    @Test
    void adminVerifyRequiresCorrectPassword() throws Exception {
        // 错误密码：无论 HTTP 状态如何，响应体的 code 都不应为 0
        MvcResult result = mvc.perform(post("/config/customization/admin/verify")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"password\":\"wrong-password\"}"))
                .andReturn();
        JsonNode body = om.readTree(result.getResponse().getContentAsString());
        assertTrue(body.get("code").asInt() != 0, "错误密码应被拒绝");
        assertFalse(body.hasNonNull("data"), "错误密码不应签发管理员令牌");
    }

    @Test
    void yamlFileBackupKept() throws Exception {
        String leader = leaderToken();
        String marker = "Backup-" + System.currentTimeMillis();
        adminJson("POST", "/config/products", leader,
                "{\"name\":\"" + marker + "\",\"active\":true}");

        // 每次写回都会生成带时间戳的备份文件
        Path backupDir = Path.of("target/test-it");
        boolean anyBackup = false;
        if (Files.isDirectory(backupDir)) {
            try (var stream = Files.list(backupDir)) {
                anyBackup = stream.anyMatch(p -> p.getFileName().toString().startsWith("dts-customization.yml.bak-"));
            }
        }
        assertTrue(anyBackup, "写回配置应生成备份文件");
    }
}
