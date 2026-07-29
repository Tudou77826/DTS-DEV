package com.dts.domain;

import com.baomidou.mybatisplus.annotation.TableName;
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
@TableName("issue_comment")
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class Comment extends BaseEntity {

    private Long issueId;

    /** 评论人 ID */
    private Long authorId;

    /** 评论内容 */
    private String content;

    /** @提及的用户 ID，逗号分隔 */
    private String mentionIds;
}
