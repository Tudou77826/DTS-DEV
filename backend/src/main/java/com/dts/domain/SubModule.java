package com.dts.domain;

import com.baomidou.mybatisplus.annotation.TableName;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/** 子模块（分类标签，如 策略下发；一个开发/负责人可归属一个子模块）。 */
@Getter
@Setter
@TableName("cfg_sub_module")
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class SubModule extends BaseEntity {

    private String name;

    @lombok.Builder.Default
    private Boolean active = true;
}
