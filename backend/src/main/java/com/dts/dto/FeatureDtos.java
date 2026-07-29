package com.dts.dto;

import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

import java.time.LocalDateTime;
import java.util.List;

/** 增强功能相关请求与响应。 */
public final class FeatureDtos {

    private FeatureDtos() {}

    @Data
    public static class BatchAssignRequest {
        @NotEmpty(message = "请选择问题")
        private List<Long> issueIds;
        @NotNull(message = "责任人不能为空")
        private Long assigneeId;
        private List<Long> collaboratorIds;
        private String priority;
        private LocalDateTime planFinishAt;
        private String remark;
    }

    @Data
    public static class BatchCloseRequest {
        @NotEmpty(message = "请选择问题")
        private List<Long> issueIds;
        private String remark;
    }

    @Data
    public static class BatchResult {
        private int succeeded;
        private int failed;
        private List<String> errors;
    }

    @Data
    public static class RelationRequest {
        @NotNull(message = "关联问题不能为空")
        private Long targetIssueId;
        @NotNull(message = "关联类型不能为空")
        private String relationType;
    }

    @Data
    public static class RelationVo {
        private Long id;
        private Long issueId;
        private String issueCode;
        private String title;
        private String description;
        private String relationType;
        private Long createdBy;
        private LocalDateTime createdAt;
    }

    @Data
    public static class AttachmentVo {
        private Long id;
        private Long issueId;
        private Long uploaderId;
        private String uploaderName;
        private String sourceType;
        private Long sourceId;
        private String originalName;
        private String contentType;
        private Long fileSize;
        private LocalDateTime createdAt;
    }
}
