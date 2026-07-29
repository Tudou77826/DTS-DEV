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
 * 问题进展记录：开发人员持续记录定位进展、阻塞、下一步等，按时间形成时间线。
 */
@Getter
@Setter
@Entity
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Table(name = "issue_progress")
public class IssueProgress extends BaseEntity {

    @Column(name = "issue_id", nullable = false)
    private Long issueId;

    /** 记录人 ID */
    @Column(name = "author_id", nullable = false)
    private Long authorId;

    /** 进展类型：PROGRESS / BLOCKER / NEXT_STEP / ROOT_CAUSE / WORKAROUND / RESOLUTION / VERIFY */
    @Column(name = "type", nullable = false, length = 32)
    private String type;

    /** 内容 */
    @Column(name = "content", nullable = false, columnDefinition = "TEXT")
    private String content;
}
