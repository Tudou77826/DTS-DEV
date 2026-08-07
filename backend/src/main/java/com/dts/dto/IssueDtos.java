package com.dts.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

import java.time.LocalDateTime;
import java.util.List;

public class IssueDtos {

    /** 新建/编辑问题入参 */
    @Data
    public static class IssueSaveRequest {
        private Long id;
        @NotNull(message = "所属模块不能为空")
        private Long moduleId;
        @NotBlank(message = "问题标题不能为空")
        private String title;
        @NotBlank(message = "问题描述不能为空")
        private String description;
        private String searchKeywords;
        private String envInfo;
        private String vpnInfo;
        private Long domainId;
        private String productName;
        private String submitterNo;
        private String foundVersionName;
        /** 优先级技术值；为空时使用当前接入配置的默认优先级。 */
        private String priority;
        /** 指定处理人（非必选，须为启用的开发人员） */
        private Long assigneeId;
        /** 子模块（选填，如 PL团队） */
        private String subModule;
        /** 期望解决时间 */
        private LocalDateTime expectedFinishAt;
        /** DTS 系统问题单号 */
        private String dtsTicketNo;
    }

    /** 查询条件 */
    @Data
    public static class IssueQuery {
        public String keyword;        // 编号或关键字
        public Long moduleId;
        public String productName;
        public Long domainId;
        public String status;
        public Long submitterId;
        public Long assigneeId;
        public String foundVersionName;
        public String investigateVersionName;
        public LocalDateTime createdFrom;
        public LocalDateTime createdTo;
        /** 为 true 时仅返回已超期（超过计划完成时间且仍处于活动状态）的问题 */
        public boolean overdue;
        public int page = 1;
        public int size = 20;
    }

    /** 分配/转派 */
    @Data
    public static class AssignRequest {
        private Long assigneeId;
        private List<Long> collaboratorIds;
        private String priority;
        private LocalDateTime planFinishAt;
        /** 状态（可选，分配时通常切到 待定位/定位中） */
        private String status;
        private String remark;
    }

    /** 状态变更 */
    @Data
    public static class StatusChangeRequest {
        @NotBlank(message = "状态不能为空")
        private String status;
        private String remark;
        /** 转为已解决/已关闭时填写的 DTS 系统问题单号（若标注为是问题） */
        private String dtsTicketNo;
        /** 是问题/非问题标注：PROBLEM / NON_PROBLEM（已解决、已关闭时必填） */
        private String issueFlag;
        /** 非问题时的处理结论（标注为非问题时必填） */
        private String resolution;
    }

    /** 进展记录 */
    @Data
    public static class ProgressRequest {
        @NotBlank(message = "类型不能为空")
        private String type; // PROGRESS/BLOCKER/NEXT_STEP/ROOT_CAUSE/WORKAROUND/RESOLUTION/VERIFY
        @NotBlank(message = "内容不能为空")
        private String content;
        /** 若为 true，同步更新问题上的对应汇总字段（如根因、结论） */
        private boolean syncToIssue = true;
    }

    /** 评论 */
    @Data
    public static class CommentRequest {
        @NotBlank(message = "评论内容不能为空")
        private String content;
        private List<Long> mentionIds;
    }
}
