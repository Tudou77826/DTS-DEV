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
 * 开发人员问题（核心实体）。
 * <p>
 * 状态机：待分配 → 待定位 → 定位中 → 待验证 → 已解决 → 已关闭
 * 辅助状态：待补充信息 / 暂缓处理 / 无法复现 / 无须处理 / 重新打开
 */
@Getter
@Setter
@Entity
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Table(name = "issue")
public class Issue extends BaseEntity {

    /** 问题编号，如 ISS-2026-0001，生成规则见 service */
    @Column(nullable = false, unique = true, length = 32)
    private String code;

    /** 提出时间 */
    @Column(name = "raised_at", nullable = false)
    private LocalDateTime raisedAt;

    /** 所属模块 */
    @Column(name = "module_id")
    private Long moduleId;

    /** 问题描述 */
    @Column(name = "description", nullable = false, columnDefinition = "TEXT")
    private String description;

    /** 查询关键字（便于检索，如文件Hash、错误码、基线名称、导入时间） */
    @Column(name = "search_keywords", columnDefinition = "TEXT")
    private String searchKeywords;

    /** 环境信息 */
    @Column(name = "env_info", columnDefinition = "TEXT")
    private String envInfo;

    /** VPN 信息 */
    @Column(name = "vpn_info", length = 255)
    private String vpnInfo;

    /** 问题领域 ID */
    @Column(name = "domain_id")
    private Long domainId;

    /** 来源产品 ID */
    @Column(name = "product_id")
    private Long productId;

    /** 提出人 ID */
    @Column(name = "submitter_id", nullable = false)
    private Long submitterId;

    /** 提出人工号 */
    @Column(name = "submitter_no", length = 32)
    private String submitterNo;

    /** 发现版本 ID */
    @Column(name = "found_version_id")
    private Long foundVersionId;

    /** 优先级：LOW / MEDIUM / HIGH / URGENT */
    @Column(name = "priority", nullable = false, length = 16)
    private String priority;

    /** 当前状态 */
    @Column(name = "status", nullable = false, length = 32)
    private String status;

    /** 当前责任人 ID（定位人） */
    @Column(name = "assignee_id")
    private Long assigneeId;

    /** 协同处理人 ID 列表，逗号分隔 */
    @Column(name = "collaborator_ids", length = 255)
    private String collaboratorIds;

    /** 当前定位进展（最新一条概述） */
    @Column(name = "latest_progress", columnDefinition = "TEXT")
    private String latestProgress;

    /** 根本原因 */
    @Column(name = "root_cause", columnDefinition = "TEXT")
    private String rootCause;

    /** 处理结论 */
    @Column(name = "resolution", columnDefinition = "TEXT")
    private String resolution;

    /** 临时规避方案 */
    @Column(name = "workaround", columnDefinition = "TEXT")
    private String workaround;

    /** 计划完成时间 */
    @Column(name = "plan_finish_at")
    private LocalDateTime planFinishAt;

    /** 定位开始时间（用于计算定位时长） */
    @Column(name = "located_at")
    private LocalDateTime locatedAt;

    /** 解决/验证完成时间 */
    @Column(name = "resolved_at")
    private LocalDateTime resolvedAt;

    /** 关闭时间 */
    @Column(name = "closed_at")
    private LocalDateTime closedAt;

    /** 是否超期（计算字段，不落库，DTO 层计算） */
}
