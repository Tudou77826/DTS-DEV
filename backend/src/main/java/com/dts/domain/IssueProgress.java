package com.dts.domain;

import com.baomidou.mybatisplus.annotation.TableName;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/**
 * 问题进展记录：开发人员持续记录定位进展、阻塞、下一步等，按时间形成时间线。
 */
@Getter
@Setter
@TableName("issue_progress")
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class IssueProgress extends BaseEntity {

    private Long issueId;

    /** 记录人 ID */
    private Long authorId;

    /** 进展类型：PROGRESS / BLOCKER / NEXT_STEP / ROOT_CAUSE / WORKAROUND / RESOLUTION / VERIFY */
    private String type;

    /** 内容 */
    private String content;
}
