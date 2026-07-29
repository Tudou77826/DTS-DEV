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
 * 评论与协同：@指定开发人员参与处理、补充信息等。
 */
@Getter
@Setter
@Entity
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Table(name = "issue_comment")
public class Comment extends BaseEntity {

    @Column(name = "issue_id", nullable = false)
    private Long issueId;

    /** 评论人 ID */
    @Column(name = "author_id", nullable = false)
    private Long authorId;

    /** 评论内容 */
    @Column(name = "content", nullable = false, columnDefinition = "TEXT")
    private String content;

    /** @提及的用户 ID，逗号分隔 */
    @Column(name = "mention_ids", length = 255)
    private String mentionIds;
}
