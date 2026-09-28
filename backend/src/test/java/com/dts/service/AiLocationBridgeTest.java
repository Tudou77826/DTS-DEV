package com.dts.service;

import com.dts.dto.IssueVo;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;

import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;

class AiLocationBridgeTest {
    @Test
    void sendsOnlyApprovedIssueFields() {
        IssueVo issue = new IssueVo();
        issue.setId(7L);
        issue.setTitle("定位问题");
        issue.setDescription("策略未生效");
        issue.setVpnInfo("secret-vpn-connection");
        issue.setSubmitterNo("employee-secret");

        Map<String, Object> snapshot = new AiLocationBridge(new ObjectMapper()).snapshot(issue);

        assertEquals(7L, snapshot.get("id"));
        assertEquals("策略未生效", snapshot.get("description"));
        assertFalse(snapshot.containsKey("vpnInfo"));
        assertFalse(snapshot.containsKey("submitterNo"));
    }
}
