package com.dts.dto;

import lombok.Data;

import java.time.LocalDateTime;
import java.util.List;

/**
 * 问题列表/详情视图对象（已解析名称）。
 */
@Data
public class IssueVo {
    private Long id;
    private String code;
    private LocalDateTime raisedAt;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;

    private Long moduleId;
    private String moduleName;
    private Long subModuleId;
    private String subModule;
    private String dtsTicketNo;

    private String title;
    private String description;
    private String searchKeywords;
    private String envInfo;
    private String vpnInfo;

    private Long domainId;
    private String domainName;

    private Long productId;
    private String productName;

    private Long submitterId;
    private String submitterName;
    private String submitterNo;

    private Long foundVersionId;
    private String foundVersionName;

    private String priority;
    private String status;
    private String issueFlag;

    private Long assigneeId;
    private String assigneeName;
    private String assigneeColor;
    private List<Long> collaboratorIds;
    private List<String> collaboratorNames;

    private String latestProgress;
    private String rootCause;
    private String resolution;
    private String workaround;

    private LocalDateTime planFinishAt;
    private LocalDateTime expectedFinishAt;
    private LocalDateTime locatedAt;
    private LocalDateTime resolvedAt;
    private LocalDateTime closedAt;

    /** 定位时长（分钟），locatedAt 到 resolvedAt 或当前 */
    private Long locateDurationMin;
    /** 是否超期 */
    private Boolean overdue;
}
