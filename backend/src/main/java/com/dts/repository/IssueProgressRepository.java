package com.dts.repository;

import com.dts.domain.IssueProgress;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface IssueProgressRepository extends JpaRepository<IssueProgress, Long> {

    List<IssueProgress> findByIssueIdOrderByCreatedAtAsc(Long issueId);
}
