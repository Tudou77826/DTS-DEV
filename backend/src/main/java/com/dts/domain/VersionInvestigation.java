package com.dts.domain;

import com.baomidou.mybatisplus.annotation.TableName;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.LocalDateTime;

/**
 * 多版本排查记录：一个问题对每个版本可独立排查。
 * <p>
 * 排查状态：待排查 / 排查中 / 存在问题 / 不存在问题 / 已修复 / 无法确认
 */
@Getter
@Setter
@TableName("version_investigation")
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class VersionInvestigation extends BaseEntity {

    private Long issueId;

    /** 产品版本 ID */
    private Long versionId;

    /** 排查版本（自由文本） */
    private String versionName;

    /** 排查负责人 ID */
    private Long investigatorId;

    /** 排查状态 */
    private String status;

    /** 排查结果说明 */
    private String result;

    /** 处理说明 */
    private String handlingNote;

    /** 修复版本 ID（如已修复） */
    private Long fixVersionId;

    /** 修复版本（自由文本） */
    private String fixVersionName;

    /** 验证结果 */
    private String verifyResult;

    /** 完成时间 */
    private LocalDateTime completedAt;
}
