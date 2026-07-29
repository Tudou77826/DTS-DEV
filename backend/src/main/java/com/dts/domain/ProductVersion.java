package com.dts.domain;

import com.baomidou.mybatisplus.annotation.TableName;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/** 产品版本。一个问题可关联多个版本进行排查。 */
@Getter
@Setter
@TableName("cfg_product_version")
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ProductVersion extends BaseEntity {

    private Long productId;

    private String version; // 如 V500R020C00

    private String description;

    @lombok.Builder.Default
    private Boolean active = true;
}
