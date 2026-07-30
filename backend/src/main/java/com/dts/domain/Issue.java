package com.dts.domain;

import com.baomidou.mybatisplus.annotation.FieldStrategy;
import com.baomidou.mybatisplus.annotation.TableField;
import com.baomidou.mybatisplus.annotation.TableName;
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
@TableName("issue")
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class Issue extends BaseEntity {

    /** 问题编号，如 ISS-260729-001，生成规则见 service */
    private String code;

    /** 提出时间 */
    private LocalDateTime raisedAt;

    /** 所属模块 */
    private Long moduleId;

    /** 问题标题 */
    private String title;

    /** 问题描述 */
    private String description;

    /** 查询关键字（便于检索，如文件Hash、错误码、基线名称、导入时间） */
    private String searchKeywords;

    /** 环境信息 */
    private String envInfo;

    /** VPN 信息 */
    private String vpnInfo;

    /** 问题领域 ID */
    private Long domainId;

    /** 来源产品 ID */
    private Long productId;

    /** 来源产品名称（自由文本） */
    private String productName;

    /** 提出人 ID */
    private Long submitterId;

    /** 提出人工号 */
    private String submitterNo;

    /** 发现版本 ID */
    private Long foundVersionId;

    /** 发现版本（自由文本） */
    private String foundVersionName;

    /** 优先级：LOW / MEDIUM / HIGH / URGENT */
    private String priority;

    /** 当前状态 */
    private String status;

    /** 当前责任人 ID（定位人） */
    private Long assigneeId;

    /** 协同处理人 ID 列表，逗号分隔 */
    private String collaboratorIds;

    /** 当前定位进展（最新一条概述） */
    private String latestProgress;

    /** 根本原因 */
    private String rootCause;

    /** 处理结论 */
    private String resolution;

    /** 临时规避方案 */
    private String workaround;

    /** 计划完成时间 */
    private LocalDateTime planFinishAt;

    /** 定位开始时间（用于计算定位时长） */
    private LocalDateTime locatedAt;

    /** 解决/验证完成时间 */
    @TableField(updateStrategy = FieldStrategy.ALWAYS)
    private LocalDateTime resolvedAt;

    /** 关闭时间 */
    @TableField(updateStrategy = FieldStrategy.ALWAYS)
    private LocalDateTime closedAt;
}
