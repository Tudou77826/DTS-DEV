package com.dts.domain;

import com.baomidou.mybatisplus.annotation.TableName;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/** 团队。 */
@Getter
@Setter
@TableName("sys_team")
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class Team extends BaseEntity {

    private String name;

    private String description;
}
