package com.dts.domain;

import com.baomidou.mybatisplus.annotation.TableName;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/** 功能模块（所属模块）。 */
@Getter
@Setter
@TableName("cfg_module")
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ProductModule extends BaseEntity {

    private Long productId;

    private String name;

    private String description;

    @lombok.Builder.Default
    private Boolean active = true;
}
