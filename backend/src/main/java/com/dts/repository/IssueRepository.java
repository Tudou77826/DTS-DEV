package com.dts.repository;

import com.dts.domain.Issue;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDateTime;
import java.util.List;

public interface IssueRepository extends JpaRepository<Issue, Long>, JpaSpecificationExecutor<Issue> {

    long countByStatus(String status);

    long countByStatusNot(String status);

    long countByStatusIn(List<String> statuses);

    long countByAssigneeIdAndStatusIn(Long assigneeId, List<String> statuses);

    long countByAssigneeIdAndCreatedAtAfter(Long assigneeId, LocalDateTime time);

    long countByCreatedAtAfter(LocalDateTime time);

    long countByAssigneeIdIsNull();

    @Query("""
            select i from Issue i
            where i.planFinishAt is not null
              and i.planFinishAt < :now
              and i.status not in ('RESOLVED', 'CLOSED')
            """)
    List<Issue> findOverdue(@Param("now") LocalDateTime now);

    @Query("""
            select i.status as status, count(i) as cnt
            from Issue i group by i.status
            """)
    List<StatusCount> countByStatusGrouped();

    @Query("""
            select i.moduleId as bucket, count(i) as cnt
            from Issue i where i.moduleId is not null group by i.moduleId
            """)
    List<BucketCount> countByModuleGrouped();

    @Query("""
            select i.assigneeId as bucket, count(i) as cnt
            from Issue i
            where i.assigneeId is not null
              and i.status not in ('RESOLVED', 'CLOSED')
            group by i.assigneeId
            """)
    List<BucketCount> countPendingByAssignee();

    interface StatusCount {
        String getStatus();
        Long getCnt();
    }

    interface BucketCount {
        Long getBucket();
        Long getCnt();
    }
}
