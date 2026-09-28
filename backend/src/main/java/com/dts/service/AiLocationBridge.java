package com.dts.service;

import com.dts.common.BusinessException;
import com.dts.dto.IssueVo;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.annotation.PostConstruct;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.util.LinkedHashMap;
import java.util.Map;

/** DTS 与独立定位服务之间唯一的 HTTP 契约入口。 */
@Slf4j
@Service
@RequiredArgsConstructor
public class AiLocationBridge {
    private final ObjectMapper mapper;
    private final HttpClient client = HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(2)).build();

    @Value("${app.ai-location.url:http://127.0.0.1:8091}")
    private String serverUrl;
    @Value("${app.ai-location.key:local-dev-ai-key}")
    private String serviceKey;
    @Value("${app.ai-location.enabled:false}")
    private boolean enabled;

    @PostConstruct
    void validateConfiguration() {
        if (!enabled) return;
        String host = URI.create(serverUrl).getHost();
        if ("local-dev-ai-key".equals(serviceKey)
                && !"127.0.0.1".equals(host) && !"localhost".equalsIgnoreCase(host) && !"::1".equals(host)) {
            throw new IllegalStateException("远程 AI 定位服务必须配置 APP_AI_LOCATION_KEY");
        }
    }

    public boolean enabled() { return enabled; }

    /** 显式白名单；VPN 连接信息等不发送给 AI 服务。 */
    public Map<String, Object> snapshot(IssueVo issue) {
        Map<String, Object> data = new LinkedHashMap<>();
        data.put("id", issue.getId());
        data.put("code", issue.getCode());
        data.put("title", issue.getTitle());
        data.put("description", issue.getDescription());
        data.put("moduleName", issue.getModuleName());
        data.put("subModule", issue.getSubModule());
        data.put("productName", issue.getProductName());
        data.put("foundVersionName", issue.getFoundVersionName());
        data.put("envInfo", issue.getEnvInfo());
        data.put("latestProgress", issue.getLatestProgress());
        data.put("submitterId", issue.getSubmitterId());
        data.put("submitterName", issue.getSubmitterName());
        data.put("assigneeId", issue.getAssigneeId());
        data.put("assigneeName", issue.getAssigneeName());
        data.put("status", issue.getStatus());
        return data;
    }

    @Async("aiLocationExecutor")
    public void submitIssue(IssueVo issue) {
        if (!enabled) return;
        try {
            request("POST", "/ai-location/issues", Map.of("issue", snapshot(issue)));
        } catch (Exception ex) {
            log.warn("AI location event delivery failed for issue {}: {}", issue.getId(), ex.getMessage());
        }
    }

    public Map<String, Object> request(String method, String path, Object payload) {
        if (!enabled) throw new BusinessException(503, "AI 辅助定位服务未启用");
        try {
            HttpRequest.Builder builder = HttpRequest.newBuilder(URI.create(serverUrl + path))
                    .timeout(Duration.ofSeconds(8))
                    .header("X-AI-Location-Key", serviceKey)
                    .header("Content-Type", "application/json");
            if ("GET".equals(method)) builder.GET();
            else builder.method(method, HttpRequest.BodyPublishers.ofString(mapper.writeValueAsString(payload)));
            HttpResponse<String> response = client.send(builder.build(), HttpResponse.BodyHandlers.ofString());
            Map<String, Object> data = mapper.readValue(response.body(), new TypeReference<>() {});
            if (response.statusCode() >= 400) {
                throw new BusinessException(response.statusCode(), String.valueOf(data.getOrDefault("error", "定位服务请求失败")));
            }
            return data;
        } catch (BusinessException ex) {
            throw ex;
        } catch (Exception ex) {
            log.warn("AI location request failed: {}", ex.getMessage());
            throw new BusinessException(503, "AI 辅助定位服务暂不可用");
        }
    }
}
