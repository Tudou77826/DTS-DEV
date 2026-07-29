package com.dts.domain;

import com.baomidou.mybatisplus.annotation.TableName;
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
@TableName("operation_log")
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class OperationLog extends BaseEntity {

    /** 关联问题 ID（也可扩展到其他资源） */
    private Long issueId;

    /** 操作人 ID */
    private Long operatorId;

    /** 操作类型：CREATE / STATUS / ASSIGNEE / PRIORITY / TRANSFER / REOPEN / ADD_VERSION / ... */
    private String action;

    /** 变更字段 */
    private String field;

    /** 旧值 */
    private String oldValue;

    /** 新值 */
    private String newValue;

    /** 说明 */
    private String remark;
}
