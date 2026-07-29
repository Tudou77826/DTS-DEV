package com.dts.repository;

import com.dts.domain.ProductVersion;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface ProductVersionRepository extends JpaRepository<ProductVersion, Long> {
    List<ProductVersion> findByProductIdAndActiveTrue(Long productId);
    List<ProductVersion> findByActiveTrue();
}
