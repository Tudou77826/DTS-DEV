package com.dts.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;
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
@Entity
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Table(name = "version_investigation")
public class VersionInvestigation extends BaseEntity {

    @Column(name = "issue_id", nullable = false)
    private Long issueId;

    /** 产品版本 ID */
    @Column(name = "version_id", nullable = false)
    private Long versionId;

    /** 排查负责人 ID */
    @Column(name = "investigator_id")
    private Long investigatorId;

    /** 排查状态 */
    @Column(name = "status", nullable = false, length = 32)
    private String status;

    /** 排查结果说明 */
    @Column(name = "result", columnDefinition = "TEXT")
    private String result;

    /** 处理说明 */
    @Column(name = "handling_note", columnDefinition = "TEXT")
    private String handlingNote;

    /** 修复版本 ID（如已修复） */
    @Column(name = "fix_version_id")
    private Long fixVersionId;

    /** 验证结果 */
    @Column(name = "verify_result", columnDefinition = "TEXT")
    private String verifyResult;

    /** 完成时间 */
    @Column(name = "completed_at")
    private LocalDateTime completedAt;
}
