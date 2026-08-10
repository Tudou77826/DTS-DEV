package com.dts.it;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;

import java.nio.file.Files;
import java.nio.file.Path;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * 集成测试基类与冒烟测试：真实 Spring 上下文 + SQLite 临时库 + Flyway 全量迁移。
 * 覆盖核心闭环（登录 → 创建 → 分配 → 流转 → 关闭）与权限/作用域规则。
 */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class IssueFlowIT {

    @Autowired
    protected MockMvc mvc;

    @Autowired
    protected ObjectMapper om;

    /**
     * 每个测试类运行前清理测试库（context 创建之前执行）。
     * 多个 IT 类可能复用同一上下文（同一 SQLite 连接），此时文件被占用无法删除，
     * 属预期情况——库已完成迁移与种子数据，可直接复用。
     */
    @BeforeAll
    static void cleanDatabase() throws Exception {
        Path dir = Path.of("target/test-it");
        Files.createDirectories(dir);
        try {
            Files.deleteIfExists(dir.resolve("dts-it.db"));
        } catch (java.nio.file.FileSystemException ignored) {
            // 上下文已缓存、连接占用中：沿用现有库
        }
    }

    protected String login(String username, String password) throws Exception {
        MvcResult result = mvc.perform(post("/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"username\":\"" + username + "\",\"password\":\"" + password + "\"}"))
                .andExpect(status().isOk())
                .andReturn();
        JsonNode body = om.readTree(result.getResponse().getContentAsString());
        assertEquals(0, body.get("code").asInt(), "登录应成功: " + body);
        return body.get("data").get("token").asText();
    }

    protected JsonNode getJson(String path, String token) throws Exception {
        MvcResult result = mvc.perform(get(path).header("X-Auth-Token", token))
                .andExpect(status().isOk())
                .andReturn();
        return om.readTree(result.getResponse().getContentAsString());
    }

    protected JsonNode postJson(String path, String token, Object body) throws Exception {
        MvcResult result = mvc.perform(post(path)
                        .header("X-Auth-Token", token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(om.writeValueAsString(body)))
                .andExpect(status().isOk())
                .andReturn();
        return om.readTree(result.getResponse().getContentAsString());
    }

    /** 不校验 HTTP 状态的请求，用于断言业务拒绝（4xx + code != 0）。 */
    protected JsonNode postAny(String path, String token, Object body) throws Exception {
        MvcResult result = mvc.perform(post(path)
                        .header("X-Auth-Token", token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(om.writeValueAsString(body)))
                .andReturn();
        return om.readTree(result.getResponse().getContentAsString());
    }

    protected JsonNode postRawJson(String path, String token, String rawBody) throws Exception {
        MvcResult result = mvc.perform(post(path)
                        .header("X-Auth-Token", token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(rawBody))
                .andExpect(status().isOk())
                .andReturn();
        return om.readTree(result.getResponse().getContentAsString());
    }

    /** 带管理员令牌的 JSON 请求（用于字典写入、配置读写等需要 ROLE_ADMIN 的接口）。 */
    protected JsonNode adminJson(String method, String path, String token, String body) throws Exception {
        String admin = adminToken();
        var builder = switch (method) {
            case "POST" -> post(path);
            case "DELETE" -> delete(path);
            default -> throw new IllegalArgumentException(method);
        };
        MvcResult result = mvc.perform(builder
                        .header("X-Auth-Token", token)
                        .header("X-Admin-Token", admin)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body == null ? "{}" : body))
                .andExpect(status().isOk())
                .andReturn();
        return om.readTree(result.getResponse().getContentAsString());
    }

    protected JsonNode adminGet(String path, String token) throws Exception {
        String admin = adminToken();
        MvcResult result = mvc.perform(get(path)
                        .header("X-Auth-Token", token)
                        .header("X-Admin-Token", admin))
                .andExpect(status().isOk())
                .andReturn();
        return om.readTree(result.getResponse().getContentAsString());
    }

    protected String adminToken() throws Exception {
        return postRawJson("/config/customization/admin/verify", null,
                "{\"password\":\"123456\"}").get("data").get("token").asText();
    }

    @Test
    void contextLoadsAndLoginWorks() throws Exception {
        String token = login("leader", "123456");
        assertTrue(token.length() > 20);
        // 字典读取（普通登录即可访问）
        JsonNode dict = getJson("/config/dictionaries", token);
        assertTrue(dict.get("data").get("products").size() >= 3);
        assertTrue(dict.get("data").get("developers").size() >= 2);
    }
}
