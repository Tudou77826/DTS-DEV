package com.dts.repository;

import com.dts.domain.IssueDomain;
import org.springframework.data.jpa.repository.JpaRepository;

public interface IssueDomainRepository extends JpaRepository<IssueDomain, Long> {
}
