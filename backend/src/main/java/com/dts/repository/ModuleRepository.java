package com.dts.repository;

import com.dts.domain.ProductModule;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface ModuleRepository extends JpaRepository<ProductModule, Long> {
    List<ProductModule> findByProductIdAndActiveTrue(Long productId);
    List<ProductModule> findByActiveTrue();
}
