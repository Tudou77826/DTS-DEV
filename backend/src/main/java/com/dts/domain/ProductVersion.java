package com.dts.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/** 产品版本。一个问题可关联多个版本进行排查。 */
@Getter
@Setter
@Entity
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Table(name = "cfg_product_version")
public class ProductVersion extends BaseEntity {

    @Column(name = "product_id")
    private Long productId;

    @Column(nullable = false, length = 64)
    private String version; // 如 V500R020C00

    @Column(length = 255)
    private String description;

    @lombok.Builder.Default
    @Column(nullable = false)
    private Boolean active = true;
}
