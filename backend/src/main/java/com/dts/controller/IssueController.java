package com.dts.controller;

import com.alibaba.excel.EasyExcel;
import com.dts.common.ApiResponse;
import com.dts.common.PageResult;
import com.dts.domain.Comment;
import com.dts.domain.IssueProgress;
import com.dts.domain.OperationLog;
import com.dts.dto.FeatureDtos;
import com.dts.dto.IssueDtos;
import com.dts.dto.IssueExportRow;
import com.dts.dto.IssueVo;
import com.dts.service.IssueService;
import com.dts.service.AiLocationBridge;
import com.dts.service.FeatureGuard;
import jakarta.validation.Valid;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.web.bind.annotation.*;

import java.io.IOException;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/issues")
@RequiredArgsConstructor
@Slf4j
public class IssueController {

    private final IssueService issueService;
    private final FeatureGuard featureGuard;
    private final AiLocationBridge aiLocationBridge;

    private void submitAiBestEffort(IssueVo issue) {
        try {
            aiLocationBridge.submitIssue(issue);
        } catch (RuntimeException ex) {
            log.warn("AI location scheduling failed for issue {}: {}", issue.getId(), ex.getMessage());
        }
    }

    @GetMapping
    public ApiResponse<PageResult<IssueVo>> page(IssueDtos.IssueQuery query) {
        return ApiResponse.ok(issueService.page(query));
    }

    @GetMapping("/export")
    public void export(IssueDtos.IssueQuery query, HttpServletResponse response) throws IOException {
        featureGuard.requireEnabled("excel-export", "Excel 导出");
        response.setContentType("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
        response.setCharacterEncoding(StandardCharsets.UTF_8.name());
        String fileName = URLEncoder.encode("问题列表", StandardCharsets.UTF_8).replace("+", "%20");
        response.setHeader("Content-Disposition", "attachment; filename*=UTF-8''" + fileName + ".xlsx");
        EasyExcel.write(response.getOutputStream(), IssueExportRow.class)
                .autoCloseStream(false)
                .sheet("问题列表")
                .doWrite(issueService.exportRows(query));
    }

    @PostMapping("/batch/assign")
    public ApiResponse<FeatureDtos.BatchResult> batchAssign(
            @Valid @RequestBody FeatureDtos.BatchAssignRequest request) {
        featureGuard.requireEnabled("batch-operations", "批量操作");
        return ApiResponse.ok(issueService.batchAssign(request));
    }

    @PostMapping("/batch/close")
    public ApiResponse<FeatureDtos.BatchResult> batchClose(
            @Valid @RequestBody FeatureDtos.BatchCloseRequest request) {
        featureGuard.requireEnabled("batch-operations", "批量操作");
        return ApiResponse.ok(issueService.batchClose(request));
    }

    @GetMapping("/{id}")
    public ApiResponse<IssueVo> detail(@PathVariable Long id) {
        return ApiResponse.ok(issueService.detail(id));
    }

    @PostMapping
    public ApiResponse<IssueVo> create(@Valid @RequestBody IssueDtos.IssueSaveRequest req) {
        IssueVo issue = issueService.create(req);
        submitAiBestEffort(issue);
        return ApiResponse.ok(issue);
    }

    @PutMapping("/{id}")
    public ApiResponse<IssueVo> update(@PathVariable Long id, @Valid @RequestBody IssueDtos.IssueSaveRequest req) {
        req.setId(id);
        IssueVo issue = issueService.update(req);
        submitAiBestEffort(issue);
        return ApiResponse.ok(issue);
    }

    // ─── 分配/状态 ───

    @PostMapping("/{id}/assign")
    public ApiResponse<IssueVo> assign(@PathVariable Long id, @RequestBody IssueDtos.AssignRequest req) {
        IssueVo issue = issueService.assign(id, req);
        submitAiBestEffort(issue);
        return ApiResponse.ok(issue);
    }

    @PostMapping("/{id}/status")
    public ApiResponse<IssueVo> changeStatus(@PathVariable Long id, @RequestBody IssueDtos.StatusChangeRequest req) {
        IssueVo issue = issueService.changeStatus(id, req);
        submitAiBestEffort(issue);
        return ApiResponse.ok(issue);
    }

    // ─── 进展 ───

    @GetMapping("/{id}/progress")
    public ApiResponse<List<IssueProgress>> progress(@PathVariable Long id) {
        return ApiResponse.ok(issueService.progressTimeline(id));
    }

    @PostMapping("/{id}/progress")
    public ApiResponse<IssueProgress> addProgress(@PathVariable Long id, @Valid @RequestBody IssueDtos.ProgressRequest req) {
        return ApiResponse.ok(issueService.addProgress(id, req));
    }

    // ─── 评论 ───

    @GetMapping("/{id}/comments")
    public ApiResponse<List<Comment>> comments(@PathVariable Long id) {
        return ApiResponse.ok(issueService.comments(id));
    }

    @PostMapping("/{id}/comments")
    public ApiResponse<Comment> addComment(@PathVariable Long id, @Valid @RequestBody IssueDtos.CommentRequest req) {
        return ApiResponse.ok(issueService.addComment(id, req));
    }

    // ─── 操作日志 ───

    @GetMapping("/{id}/operations")
    public ApiResponse<List<OperationLog>> operations(@PathVariable Long id) {
        return ApiResponse.ok(issueService.operations(id));
    }

    // ─── 我的任务 ───

    @GetMapping("/my-tasks")
    public ApiResponse<PageResult<IssueVo>> myTasks(
            @RequestParam(defaultValue = "all") String tab,
            @RequestParam(defaultValue = "1") int page,
            @RequestParam(defaultValue = "20") int size) {
        return ApiResponse.ok(issueService.myTasks(tab, page, size));
    }

    @GetMapping("/my-summary")
    public ApiResponse<Map<String, Long>> mySummary() {
        return ApiResponse.ok(issueService.mySummary());
    }
}
