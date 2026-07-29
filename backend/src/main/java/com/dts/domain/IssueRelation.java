package com.dts.domain;

import com.baomidou.mybatisplus.annotation.TableName;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/** 问题关联：RELATED（相关）或 DUPLICATE（重复）。 */
@Getter
@Setter
@TableName("issue_relation")
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class IssueRelation extends BaseEntity {

    private Long sourceIssueId;
    private Long targetIssueId;
    private String relationType;
    private Long createdBy;
}
