package com.dts.domain;

import com.baomidou.mybatisplus.annotation.TableName;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.LocalDateTime;

/** 使用反馈（用户提交，项目负责人处理）。 */
@Getter
@Setter
@TableName("sys_feedback")
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class Feedback extends BaseEntity {

    /** 提交人 ID */
    private Long userId;

    /** 反馈内容（富文本，可内嵌 base64 图片） */
    private String content;

    /** 状态：OPEN / PROCESSED */
    private String status;

    /** 处理人 ID */
    private Long handledBy;

    /** 处理时间 */
    private LocalDateTime handledAt;

    /** 处理回复 */
    private String reply;
}
