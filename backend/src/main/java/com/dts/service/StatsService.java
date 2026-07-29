package com.dts.service;

import com.dts.domain.IssueStatus;
import com.dts.dto.IssueVo;
import com.dts.repository.IssueRepository;
import com.dts.repository.VersionInvestigationRepository;
import com.dts.service.LookupService;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

@Service
@RequiredArgsConstructor
public class StatsService {

    private final IssueRepository issueRepository;
    private final VersionInvestigationRepository investigationRepository;
    private final LookupService lookup;

    @Transactional(readOnly = true)
    public Map<String, Object> overview() {
        Map<String, Object> m = new HashMap<>();
        m.put("total", issueRepository.count());
        m.put("todayNew", issueRepository.countByCreatedAtAfter(LocalDateTime.now().toLocalDate().atStartOfDay()));
        m.put("resolved", issueRepository.countByStatus(IssueStatus.RESOLVED)
                + issueRepository.countByStatus(IssueStatus.CLOSED));
        m.put("unclosed", issueRepository.countByStatusNot(IssueStatus.CLOSED));
        m.put("unassigned", issueRepository.countByAssigneeIdIsNull());
        m.put("overdue", issueRepository.findOverdue(LocalDateTime.now()).size());

        // 各状态分布
        Map<String, Long> statusDist = new HashMap<>();
        issueRepository.countByStatusGrouped().forEach(s -> statusDist.put(s.getStatus(), s.getCnt()));
        m.put("statusDist", statusDist);

        // 各模块分布
        Map<Long, Long> moduleDist = new HashMap<>();
        issueRepository.countByModuleGrouped().forEach(b -> moduleDist.put(b.getBucket(), b.getCnt()));
        Map<String, Long> moduleNamed = new HashMap<>();
        lookup.moduleNames(moduleDist.keySet()).forEach((id, name) ->
                moduleNamed.put(name, moduleDist.getOrDefault(id, 0L)));
        m.put("moduleDist", moduleNamed);

        // 各开发人员待处理数
        Map<Long, Long> devDist = new HashMap<>();
        issueRepository.countPendingByAssignee().forEach(b -> devDist.put(b.getBucket(), b.getCnt()));
        Map<String, Long> devNamed = new HashMap<>();
        lookup.userNames(devDist.keySet()).forEach((id, name) ->
                devNamed.put(name, devDist.getOrDefault(id, 0L)));
        m.put("assigneePending", devNamed);

        return m;
    }

    @Transactional(readOnly = true)
    public Map<Long, Long> versionRemainCount() {
        Map<Long, Long> result = new HashMap<>();
        investigationRepository.findAll().forEach(v -> {
            if (!"NO_ISSUE".equals(v.getStatus()) && !"FIXED".equals(v.getStatus())) {
                result.merge(v.getVersionId(), 1L, Long::sum);
            }
        });
        return result;
    }
}
