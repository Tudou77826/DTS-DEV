package com.dts.repository;

import com.dts.domain.VersionInvestigation;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface VersionInvestigationRepository extends JpaRepository<VersionInvestigation, Long> {

    List<VersionInvestigation> findByIssueId(Long issueId);

    List<VersionInvestigation> findByIssueIdIn(List<Long> issueIds);

    List<VersionInvestigation> findByVersionIdAndStatus(Long versionId, String status);

    List<VersionInvestigation> findByVersionId(Long versionId);

    long countByVersionIdAndStatusNot(Long versionId, String status);
}
