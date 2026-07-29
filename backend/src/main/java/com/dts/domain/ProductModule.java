package com.dts.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/** 功能模块（所属模块）。 */
@Getter
@Setter
@Entity
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Table(name = "cfg_module")
public class ProductModule extends BaseEntity {

    @Column(name = "product_id")
    private Long productId;

    @Column(nullable = false, length = 64)
    private String name;

    @Column(length = 255)
    private String description;

    @lombok.Builder.Default
    @Column(nullable = false)
    private Boolean active = true;
}
