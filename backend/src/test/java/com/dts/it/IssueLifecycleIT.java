package com.dts.it;

import com.fasterxml.jackson.databind.JsonNode;
import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;

import java.util.HashMap;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * 问题全生命周期集成测试：创建 → 分配 → 处理中 → 已解决（DTS/标注）→ 关闭/重开。
 * 验证状态机校验、权限矩阵、提交人自动建档等规则在真实上下文下的行为。
 */
class IssueLifecycleIT extends IssueFlowIT {

    private String devToken() throws Exception {
        return login("wangwu", "123456");
    }

    private Map<String, Object> newIssue(String title) throws Exception {
        Map<String, Object> body = new HashMap<>();
        body.put("moduleId", getJson("/config/dictionaries", login("leader", "123456"))
                .get("data").get("modules").get(0).get("id").asLong());
        body.put("title", title);
        body.put("description", "集成测试问题描述");
        body.put("vpnInfo", "VPN-IT");
        body.put("priority", "HIGH");
        return body;
    }

    @Test
    void fullLifecycleWithDtsTicket() throws Exception {
        String leader = login("leader", "123456");
        String dev = devToken();

        // 1. 创建问题（提出人自动建档为 leader）
        JsonNode created = postJson("/issues", leader, newIssue("生命周期闭环"));
        assertEquals("PENDING_ASSIGN", created.get("data").get("status").asText());
        long id = created.get("data").get("id").asLong();
        String code = created.get("data").get("code").asText();
        assertTrue(code.startsWith("ISS-"), "编号应为 ISS-yyMMdd-NNN: " + code);

        // 2. 分配 → 待处理
        JsonNode devNode = getJson("/config/dictionaries", leader).get("data").get("developers").get(0);
        long devId = devNode.get("id").asLong();
        Map<String, Object> assign = new HashMap<>();
        assign.put("assigneeId", devId);
        JsonNode assigned = postJson("/issues/" + id + "/assign", leader, assign);
        assertEquals("PENDING_HANDLE", assigned.get("data").get("status").asText());

        // 3. 责任人开始处理
        Map<String, Object> processing = new HashMap<>();
        processing.put("status", "PROCESSING");
        JsonNode proc = postJson("/issues/" + id + "/status", dev, processing);
        assertEquals("PROCESSING", proc.get("data").get("status").asText());

        // 4. 已解决：必填 处理描述 + 是问题标注 + DTS 单号
        Map<String, Object> resolved = new HashMap<>();
        resolved.put("status", "RESOLVED");
        resolved.put("remark", "已修复");
        resolved.put("issueFlag", "PROBLEM");
        resolved.put("dtsTicketNo", "DTS-IT-0001");
        JsonNode res = postJson("/issues/" + id + "/status", dev, resolved);
        assertEquals("RESOLVED", res.get("data").get("status").asText());

        // 5. 已解决后提交人关闭：需标注
        Map<String, Object> closed = new HashMap<>();
        closed.put("status", "CLOSED");
        closed.put("issueFlag", "PROBLEM");
        JsonNode cl = postJson("/issues/" + id + "/status", leader, closed);
        assertEquals("CLOSED", cl.get("data").get("status").asText());

        // 6. 提交人重新打开（复测仍复现）
        Map<String, Object> reopen = new HashMap<>();
        reopen.put("status", "PROCESSING");
        reopen.put("remark", "复测仍复现");
        JsonNode reopened = postJson("/issues/" + id + "/status", leader, reopen);
        assertEquals("PROCESSING", reopened.get("data").get("status").asText());
    }

    @Test
    void resolvedWithoutDtsTicketRejected() throws Exception {
        String leader = login("leader", "123456");
        String dev = devToken();

        JsonNode created = postJson("/issues", leader, newIssue("缺 DTS 单号"));
        long id = created.get("data").get("id").asLong();

        Map<String, Object> assign = new HashMap<>();
        assign.put("assigneeId", getJson("/config/dictionaries", leader)
                .get("data").get("developers").get(0).get("id").asLong());
        postJson("/issues/" + id + "/assign", leader, assign);

        Map<String, Object> processing = new HashMap<>();
        processing.put("status", "PROCESSING");
        postJson("/issues/" + id + "/status", dev, processing);

        // 是问题标注但缺 DTS 单号 → 拒绝
        Map<String, Object> resolved = new HashMap<>();
        resolved.put("status", "RESOLVED");
        resolved.put("remark", "已修复");
        resolved.put("issueFlag", "PROBLEM");
        JsonNode rejected = postAny("/issues/" + id + "/status", dev, resolved);
        assertTrue(rejected.get("message").asText().contains("DTS"),
                "应提示填写 DTS 单号: " + rejected.get("message").asText());
    }

    @Test
    void submitterRegistersAndSeesOnlyOwnIssuesByDefault() throws Exception {
        // 提出人通过注册接口建档（local 模式无统一认证）
        Map<String, Object> register = new HashMap<>();
        register.put("employeeNo", "S-IT-001");
        register.put("username", "submitter_it");
        register.put("displayName", "集成测试提出人");
        register.put("password", "123456");
        JsonNode registered = postJson("/auth/register", null, register);
        String token = registered.get("data").get("token").asText();
        long submitterId = registered.get("data").get("user").get("id").asLong();
        assertEquals("SUBMITTER", registered.get("data").get("user").get("role").asText());

        // 提出人创建自己的问题
        JsonNode created = postJson("/issues", token, newIssue("提出人自己的问题"));
        assertTrue(created.get("data").get("id").asLong() > 0);

        // 提出人查看问题列表：默认只看到自己的提交（submitter 自动作用域）
        JsonNode page = getJson("/issues?page=1&size=20", token);
        JsonNode records = page.get("data").get("list");
        assertTrue(records.size() >= 1, "提出人应至少看到自己的问题");
        for (JsonNode issue : records) {
            assertEquals(submitterId, issue.get("submitterId").asLong(),
                    "提出人默认只能看到自己的提交");
        }
    }

    @Test
    void listFiltersBySubModuleScope() throws Exception {
        String leader = login("leader", "123456");
        JsonNode dict = getJson("/config/dictionaries", leader).get("data");

        // leader 的归属子模块（配置里为「策略下发」）
        long leaderSubId = 0;
        for (JsonNode user : dict.get("users")) {
            if ("leader".equals(user.get("username").asText())) {
                leaderSubId = user.get("subModuleId").asLong();
            }
        }
        assertTrue(leaderSubId > 0, "leader 应有归属子模块");

        // leader 创建问题时归属到自己的子模块
        Map<String, Object> body = newIssue("作用域验证");
        body.put("subModuleId", leaderSubId);
        JsonNode created = postJson("/issues", leader, body);
        assertEquals(leaderSubId, created.get("data").get("subModuleId").asLong());

        // 不带筛选参数时，leader 默认只看到自己归属子模块内的问题
        JsonNode page = getJson("/issues?page=1&size=20", leader);
        JsonNode records = page.get("data").get("list");
        assertTrue(records.size() >= 1, "leader 应能看到自己子模块内的问题");
        for (JsonNode issue : records) {
            assertEquals(leaderSubId, issue.get("subModuleId").asLong(),
                    "leader 默认作用域应为自己的归属子模块");
        }
    }

    @Test
    void nonAssigneeCannotResolve() throws Exception {
        String leader = login("leader", "123456");
        String otherDev = login("zhaoliu", "123456");

        JsonNode created = postJson("/issues", leader, newIssue("越权解决"));
        long id = created.get("data").get("id").asLong();

        // 分配给 wangwu
        Map<String, Object> assign = new HashMap<>();
        assign.put("assigneeId", getJson("/config/dictionaries", leader)
                .get("data").get("developers").get(0).get("id").asLong());
        postJson("/issues/" + id + "/assign", leader, assign);

        // 非责任人 zhaoliu 尝试处理 → 拒绝
        Map<String, Object> processing = new HashMap<>();
        processing.put("status", "PROCESSING");
        JsonNode rejected = postAny("/issues/" + id + "/status", otherDev, processing);
        assertTrue(rejected.get("code").asInt() != 0, "非责任人不应能流转: " + rejected);
    }
}
