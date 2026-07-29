package com.dts.service;

import com.baomidou.mybatisplus.core.toolkit.Wrappers;
import com.dts.domain.Issue;
import com.dts.domain.IssueStatus;
import com.dts.domain.VersionInvestigation;
import com.dts.mapper.IssueMapper;
import com.dts.mapper.VersionInvestigationMapper;
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

    private final IssueMapper issueMapper;
    private final VersionInvestigationMapper investigationMapper;
    private final LookupService lookup;

    @Transactional(readOnly = true)
    public Map<String, Object> overview() {
        Map<String, Object> m = new HashMap<>();
        m.put("total", issueMapper.selectCount(null));
        m.put("todayNew", issueMapper.selectCount(Wrappers.<Issue>lambdaQuery()
                .ge(Issue::getCreatedAt, LocalDateTime.now().toLocalDate().atStartOfDay())));
        m.put("resolved", issueMapper.selectCount(Wrappers.<Issue>lambdaQuery()
                .in(Issue::getStatus, IssueStatus.TERMINAL)));
        m.put("unclosed", issueMapper.selectCount(Wrappers.<Issue>lambdaQuery()
                .ne(Issue::getStatus, IssueStatus.CLOSED)));
        m.put("unassigned", issueMapper.selectCount(Wrappers.<Issue>lambdaQuery()
                .isNull(Issue::getAssigneeId)));
        m.put("overdue", issueMapper.findOverdue(LocalDateTime.now()).size());

        // 各状态分布
        Map<String, Long> statusDist = new HashMap<>();
        issueMapper.countByStatusGrouped().forEach(s -> statusDist.put(s.getBucket(), s.getCnt()));
        m.put("statusDist", statusDist);

        // 各模块分布
        Map<Long, Long> moduleDist = new HashMap<>();
        issueMapper.countByModuleGrouped().forEach(b -> moduleDist.put(Long.valueOf(b.getBucket()), b.getCnt()));
        Map<String, Long> moduleNamed = new HashMap<>();
        lookup.moduleNames(moduleDist.keySet()).forEach((id, name) ->
                moduleNamed.put(name, moduleDist.getOrDefault(id, 0L)));
        m.put("moduleDist", moduleNamed);

        // 各开发人员待处理数
        Map<Long, Long> devDist = new HashMap<>();
        issueMapper.countPendingByAssignee().forEach(b -> devDist.put(Long.valueOf(b.getBucket()), b.getCnt()));
        Map<String, Long> devNamed = new HashMap<>();
        lookup.userNames(devDist.keySet()).forEach((id, name) ->
                devNamed.put(name, devDist.getOrDefault(id, 0L)));
        m.put("assigneePending", devNamed);

        return m;
    }

    @Transactional(readOnly = true)
    public Map<Long, Long> versionRemainCount() {
        Map<Long, Long> result = new HashMap<>();
        investigationMapper.selectList(null).forEach(v -> {
            if (!"NO_ISSUE".equals(v.getStatus()) && !"FIXED".equals(v.getStatus())) {
                result.merge(v.getVersionId(), 1L, Long::sum);
            }
        });
        return result;
    }
}
