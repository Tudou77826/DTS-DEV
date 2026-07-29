package com.dts.domain;

import com.baomidou.mybatisplus.annotation.TableName;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/**
 * 问题或评论附件的元数据。文件内容存储在可配置的本地目录中。
 */
@Getter
@Setter
@TableName("issue_attachment")
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class IssueAttachment extends BaseEntity {

    private Long issueId;
    private Long uploaderId;
    /** ISSUE / COMMENT */
    private String sourceType;
    private Long sourceId;
    private String originalName;
    private String storedName;
    private String contentType;
    private Long fileSize;
    private String storagePath;
}
