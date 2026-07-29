package com.dts.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/**
 * 操作时间线：记录关键字段变更（状态、责任人、优先级等）的操作人与时间。
 */
@Getter
@Setter
@Entity
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Table(name = "operation_log")
public class OperationLog extends BaseEntity {

    /** 关联问题 ID（也可扩展到其他资源） */
    @Column(name = "issue_id", nullable = false)
    private Long issueId;

    /** 操作人 ID */
    @Column(name = "operator_id", nullable = false)
    private Long operatorId;

    /** 操作类型：CREATE / STATUS / ASSIGNEE / PRIORITY / TRANSFER / REOPEN / ADD_VERSION / ... */
    @Column(name = "action", nullable = false, length = 32)
    private String action;

    /** 变更字段 */
    @Column(name = "field", length = 64)
    private String field;

    /** 旧值 */
    @Column(name = "old_value", columnDefinition = "TEXT")
    private String oldValue;

    /** 新值 */
    @Column(name = "new_value", columnDefinition = "TEXT")
    private String newValue;

    /** 说明 */
    @Column(name = "remark", columnDefinition = "TEXT")
    private String remark;
}
