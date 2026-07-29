package com.dts.domain;

import com.baomidou.mybatisplus.annotation.TableName;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.LocalDateTime;

/** 站内通知。 */
@Getter
@Setter
@TableName("notification")
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class Notification extends BaseEntity {

    private Long userId;
    private String type;
    private String title;
    private String content;
    private String link;
    private LocalDateTime readAt;
}
