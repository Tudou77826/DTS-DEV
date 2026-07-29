package com.dts.repository;

import com.dts.domain.OperationLog;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface OperationLogRepository extends JpaRepository<OperationLog, Long> {

    List<OperationLog> findByIssueIdOrderByCreatedAtAsc(Long issueId);
}
