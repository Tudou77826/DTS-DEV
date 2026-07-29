package com.dts.service;

import com.baomidou.mybatisplus.core.toolkit.Wrappers;
import com.dts.common.BusinessException;
import com.dts.domain.Issue;
import com.dts.domain.IssueStatus;
import com.dts.domain.VersionInvestigation;
import com.dts.dto.InvestigationDtos;
import com.dts.mapper.IssueMapper;
import com.dts.mapper.VersionInvestigationMapper;
import com.dts.security.SecurityUtil;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Set;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class InvestigationService {

    private static final Set<String> STATUSES = Set.of(
            "PENDING", "INVESTIGATING", "HAS_ISSUE", "NO_ISSUE", "FIXED", "UNCONFIRMED");

    private final VersionInvestigationMapper investigationMapper;
    private final IssueMapper issueMapper;

    @Transactional(readOnly = true)
    public List<VersionInvestigation> listByIssue(Long issueId) {
        return investigationMapper.selectList(Wrappers.<VersionInvestigation>lambdaQuery()
                .eq(VersionInvestigation::getIssueId, issueId)
                .orderByAsc(VersionInvestigation::getCreatedAt));
    }

    @Transactional(readOnly = true)
    public List<VersionInvestigation> listByVersion(Long versionId) {
        return investigationMapper.selectList(Wrappers.<VersionInvestigation>lambdaQuery()
                .eq(VersionInvestigation::getVersionId, versionId)
                .orderByAsc(VersionInvestigation::getCreatedAt));
    }

    @Transactional
    public VersionInvestigation create(InvestigationDtos.InvestigationSaveRequest req) {
        validateStatus(req.getStatus());
        if (issueMapper.selectById(req.getIssueId()) == null) {
            throw new BusinessException("问题不存在: " + req.getIssueId());
        }
        VersionInvestigation v = VersionInvestigation.builder()
                .issueId(req.getIssueId())
                .versionId(req.getVersionId())
                .investigatorId(req.getInvestigatorId() != null ? req.getInvestigatorId() : SecurityUtil.currentUserId())
                .status(req.getStatus())
                .result(req.getResult())
                .handlingNote(req.getHandlingNote())
                .fixVersionId(req.getFixVersionId())
                .verifyResult(req.getVerifyResult())
                .completedAt(isTerminal(req.getStatus()) ? LocalDateTime.now() : null)
                .build();
        investigationMapper.insert(v);
        return v;
    }

    @Transactional
    public VersionInvestigation update(Long id, InvestigationDtos.InvestigationSaveRequest req) {
        validateStatus(req.getStatus());
        VersionInvestigation v = investigationMapper.selectById(id);
        if (v == null) {
            throw new BusinessException("排查记录不存在: " + id);
        }
        v.setVersionId(req.getVersionId());
        if (req.getInvestigatorId() != null) v.setInvestigatorId(req.getInvestigatorId());
        v.setStatus(req.getStatus());
        v.setResult(req.getResult());
        v.setHandlingNote(req.getHandlingNote());
        v.setFixVersionId(req.getFixVersionId());
        v.setVerifyResult(req.getVerifyResult());
        if (isTerminal(req.getStatus()) && v.getCompletedAt() == null) {
            v.setCompletedAt(LocalDateTime.now());
        }
        investigationMapper.updateById(v);
        return v;
    }

    /**
     * 按版本生成待排查清单：对该版本下所有未关闭问题批量生成 待排查 记录。
     */
    @Transactional
    public InvestigationDtos.GenerateResult generateForVersion(InvestigationDtos.GenerateInvestigationRequest req) {
        List<Issue> issues;
        if (req.getIssueIds() != null && !req.getIssueIds().isEmpty()) {
            issues = issueMapper.selectByIds(req.getIssueIds());
        } else {
            issues = issueMapper.selectList(Wrappers.<Issue>lambdaQuery()
                    .notIn(Issue::getStatus, IssueStatus.TERMINAL));
        }
        // 已存在的 (issueId, versionId) 不重复创建
        List<Long> issueIds = issues.stream().map(Issue::getId).toList();
        Set<String> existing = (issueIds.isEmpty() ? List.<VersionInvestigation>of()
                : investigationMapper.selectList(Wrappers.<VersionInvestigation>lambdaQuery()
                        .in(VersionInvestigation::getIssueId, issueIds))).stream()
                .map(v -> v.getIssueId() + ":" + v.getVersionId())
                .collect(Collectors.toSet());

        long created = 0, skipped = 0;
        for (Issue issue : issues) {
            String key = issue.getId() + ":" + req.getVersionId();
            if (existing.contains(key)) {
                skipped++;
                continue;
            }
            VersionInvestigation v = VersionInvestigation.builder()
                    .issueId(issue.getId())
                    .versionId(req.getVersionId())
                    .investigatorId(req.getDefaultInvestigatorId() != null
                            ? req.getDefaultInvestigatorId() : issue.getAssigneeId())
                    .status("PENDING")
                    .build();
            investigationMapper.insert(v);
            created++;
        }
        InvestigationDtos.GenerateResult result = new InvestigationDtos.GenerateResult();
        result.setCreated(created);
        result.setSkipped(skipped);
        return result;
    }

    private void validateStatus(String status) {
        if (!STATUSES.contains(status)) {
            throw new BusinessException("非法排查状态: " + status);
        }
    }

    private boolean isTerminal(String status) {
        return "NO_ISSUE".equals(status) || "FIXED".equals(status);
    }
}
