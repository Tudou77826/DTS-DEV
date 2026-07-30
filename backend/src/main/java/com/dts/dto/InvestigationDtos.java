package com.dts.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

import java.util.List;

public class InvestigationDtos {

    /** 新增版本排查记录 */
    @Data
    public static class InvestigationSaveRequest {
        @NotNull(message = "问题ID不能为空")
        private Long issueId;
        @NotBlank(message = "版本不能为空")
        private String versionName;
        private Long investigatorId;
        @NotBlank(message = "排查状态不能为空")
        private String status;
        private String result;
        private String handlingNote;
        private String fixVersionName;
        private String verifyResult;
    }

    /** 按版本生成待排查清单 */
    @Data
    public static class GenerateInvestigationRequest {
        @NotBlank(message = "版本不能为空")
        private String versionName;
        /** 限定问题范围（为空则取所有非关闭问题） */
        private List<Long> issueIds;
        /** 默认排查人 */
        private Long defaultInvestigatorId;
    }

    @Data
    public static class GenerateResult {
        private long created;
        private long skipped;
    }
}
