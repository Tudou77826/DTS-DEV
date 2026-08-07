package com.dts.controller;

import com.dts.common.ApiResponse;
import com.dts.domain.Feedback;
import com.dts.service.FeedbackService;
import com.dts.service.LookupService;
import jakarta.validation.constraints.NotBlank;
import lombok.Data;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.List;

/** 站内反馈收集。 */
@RestController
@RequestMapping("/feedback")
@RequiredArgsConstructor
public class FeedbackController {

    private final FeedbackService feedbackService;
    private final LookupService lookupService;

    /** 提交反馈（所有登录用户） */
    @PostMapping
    public ApiResponse<Feedback> submit(@RequestBody FeedbackRequest request) {
        return ApiResponse.ok(feedbackService.submit(request.getContent()));
    }

    /** 我提交的反馈 */
    @GetMapping("/mine")
    public ApiResponse<List<FeedbackService.FeedbackVo>> mine() {
        return ApiResponse.ok(feedbackService.listMine().stream()
                .map(f -> FeedbackService.toVo(f, lookupService)).toList());
    }

    /** 全部反馈（仅项目负责人 / 管理员） */
    @GetMapping
    public ApiResponse<List<FeedbackService.FeedbackVo>> listAll() {
        return ApiResponse.ok(feedbackService.listAll().stream()
                .map(f -> FeedbackService.toVo(f, lookupService)).toList());
    }

    /** 处理反馈（仅项目负责人 / 管理员） */
    @PostMapping("/{id}/process")
    public ApiResponse<Feedback> process(@PathVariable Long id, @RequestBody FeedbackProcessRequest request) {
        return ApiResponse.ok(feedbackService.process(id, request.getReply()));
    }

    @Data
    public static class FeedbackRequest {
        @NotBlank(message = "反馈内容不能为空")
        private String content;
    }

    @Data
    public static class FeedbackProcessRequest {
        private String reply;
    }
}
