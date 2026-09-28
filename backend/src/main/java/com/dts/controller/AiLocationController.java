package com.dts.controller;

import com.dts.common.ApiResponse;
import com.dts.common.BusinessException;
import com.dts.domain.Issue;
import com.dts.dto.IssueVo;
import com.dts.security.SecurityUtil;
import com.dts.service.AiLocationBridge;
import com.dts.service.AiLocationNotificationService;
import com.dts.service.IssuePermissionService;
import com.dts.service.IssueService;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;
import org.springframework.beans.factory.annotation.Value;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;

import java.util.Map;

/** 浏览器只与已认证的 DTS API 通信，服务密钥不进入前端。 */
@RestController
@RequestMapping("/ai-location")
@RequiredArgsConstructor
public class AiLocationController {
    private final AiLocationBridge bridge;
    private final IssueService issues;
    private final IssuePermissionService permission;
    private final AiLocationNotificationService notificationService;
    @Value("${app.ai-location.key:local-dev-ai-key}")
    private String serviceKey;

    @PostMapping("/internal/questions")
    public ApiResponse<Void> notifyQuestion(@RequestHeader("X-AI-Location-Key") String key,
                                            @RequestBody Map<String, Object> body) {
        if (!MessageDigest.isEqual(key.getBytes(StandardCharsets.UTF_8), serviceKey.getBytes(StandardCharsets.UTF_8))) {
            throw new BusinessException(403, "无效的服务密钥");
        }
        notificationService.notifyQuestion(body);
        return ApiResponse.ok(null);
    }

    private IssueVo accessibleIssue(Long id) {
        Issue issue = issues.get(id);
        permission.requireParticipantOrLeader(issue);
        return issues.detail(id);
    }

    @GetMapping("/issues/{id}")
    public ApiResponse<Map<String, Object>> issue(@PathVariable Long id) {
        accessibleIssue(id);
        return ApiResponse.ok(bridge.request("GET", "/ai-location/issues/" + id, null));
    }

    @PostMapping("/issues/{id}/runs")
    public ApiResponse<Map<String, Object>> run(@PathVariable Long id) {
        IssueVo issue = accessibleIssue(id);
        return ApiResponse.ok(bridge.request("POST", "/ai-location/issues/" + id + "/runs", Map.of("issue", bridge.snapshot(issue))));
    }

    @PostMapping("/issues/{id}/questions/{questionId}/answer")
    public ApiResponse<Map<String, Object>> answer(@PathVariable Long id, @PathVariable String questionId,
                                                   @RequestBody Map<String, String> body) {
        accessibleIssue(id);
        return ApiResponse.ok(bridge.request("POST", "/ai-location/questions/" + questionId + "/answer",
                Map.of("issueId", id, "actorId", SecurityUtil.currentUserId(),
                        "answer", body.getOrDefault("answer", ""))));
    }

    @PostMapping("/issues/{id}/jobs/{jobId}/feedback")
    public ApiResponse<Map<String, Object>> feedback(@PathVariable Long id, @PathVariable String jobId,
                                                     @RequestBody Map<String, String> body) {
        accessibleIssue(id);
        return ApiResponse.ok(bridge.request("POST", "/ai-location/jobs/" + jobId + "/feedback",
                Map.of("issueId", id, "value", body.getOrDefault("value", ""))));
    }

    private void requireAdmin() {
        if (!SecurityUtil.isAdmin()) throw new BusinessException(403, "仅管理员可查看 AI 定位管理数据");
    }

    @GetMapping("/admin/overview")
    public ApiResponse<Map<String, Object>> overview() {
        requireAdmin();
        return ApiResponse.ok(bridge.request("GET", "/ai-location/admin/overview", null));
    }

    @GetMapping("/admin/jobs")
    public ApiResponse<Map<String, Object>> jobs() {
        requireAdmin();
        return ApiResponse.ok(bridge.request("GET", "/ai-location/admin/jobs", null));
    }

    @GetMapping("/admin/settings")
    public ApiResponse<Map<String, Object>> settings() {
        requireAdmin();
        return ApiResponse.ok(bridge.request("GET", "/ai-location/admin/settings", null));
    }

    @PutMapping("/admin/settings")
    public ApiResponse<Map<String, Object>> settings(@RequestBody Map<String, Object> body) {
        requireAdmin();
        return ApiResponse.ok(bridge.request("PUT", "/ai-location/admin/settings", body));
    }

    @PostMapping("/admin/jobs/{jobId}/retry")
    public ApiResponse<Map<String, Object>> retry(@PathVariable String jobId) {
        requireAdmin();
        return ApiResponse.ok(bridge.request("POST", "/ai-location/admin/jobs/" + jobId + "/retry", Map.of()));
    }
}
