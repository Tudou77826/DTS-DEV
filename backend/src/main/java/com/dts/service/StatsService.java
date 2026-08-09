package com.dts.service;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.core.toolkit.Wrappers;
import com.dts.domain.Issue;
import com.dts.domain.IssueStatus;
import com.dts.mapper.IssueMapper;
import com.dts.mapper.VersionInvestigationMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
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

    /**
     * 统计看板。支持按 模块(moduleId) / 子模块(subModuleId) 过滤：
     * null 或 0 表示全部，>0 表示只看该模块/子模块。
     */
    @Transactional(readOnly = true)
    public Map<String, Object> overview(Long moduleId, Long subModuleId) {
        LambdaQueryWrapper<Issue> base = new LambdaQueryWrapper<>();
        if (moduleId != null && moduleId > 0) {
            base.eq(Issue::getModuleId, moduleId);
        }
        if (subModuleId != null && subModuleId > 0) {
            base.eq(Issue::getSubModuleId, subModuleId);
        }
        List<Issue> issues = issueMapper.selectList(base);
        LocalDateTime todayStart = LocalDate.now().atStartOfDay();
        LocalDateTime now = LocalDateTime.now();

        Map<String, Object> m = new HashMap<>();
        m.put("total", issues.size());
        m.put("todayNew", issues.stream().filter(i -> i.getCreatedAt() != null && !i.getCreatedAt().isBefore(todayStart)).count());
        m.put("resolved", issues.stream().filter(i -> IssueStatus.TERMINAL.contains(i.getStatus())).count());
        m.put("unclosed", issues.stream().filter(i -> !IssueStatus.CLOSED.equals(i.getStatus())).count());
        m.put("unassigned", issues.stream().filter(i -> i.getAssigneeId() == null).count());
        m.put("overdue", issues.stream().filter(i -> i.getPlanFinishAt() != null
                && i.getPlanFinishAt().isBefore(now) && IssueStatus.ACTIVE.contains(i.getStatus())).count());

        // 各状态分布（按状态机顺序）
        Map<String, Long> statusDist = new HashMap<>();
        for (Issue issue : issues) {
            statusDist.merge(issue.getStatus(), 1L, Long::sum);
        }
        m.put("statusDist", statusDist);

        // 各模块分布
        Map<String, Long> moduleNamed = new HashMap<>();
        for (Issue issue : issues) {
            if (issue.getModuleId() != null) {
                String name = lookup.moduleName(issue.getModuleId());
                if (name != null) moduleNamed.merge(name, 1L, Long::sum);
            }
        }
        m.put("moduleDist", moduleNamed);

        // 各子模块分布
        Map<String, Long> subModuleDist = new HashMap<>();
        for (Issue issue : issues) {
            if (issue.getSubModuleId() != null) {
                String name = lookup.subModuleName(issue.getSubModuleId());
                if (name != null) subModuleDist.merge(name, 1L, Long::sum);
            } else if (issue.getSubModule() != null && !issue.getSubModule().isBlank()) {
                subModuleDist.merge(issue.getSubModule(), 1L, Long::sum);
            }
        }
        m.put("subModuleDist", subModuleDist);

        // 各开发人员待处理数
        Map<String, Long> devNamed = new HashMap<>();
        for (Issue issue : issues) {
            if (issue.getAssigneeId() != null && IssueStatus.ACTIVE.contains(issue.getStatus())) {
                String name = lookup.userName(issue.getAssigneeId());
                if (name != null) devNamed.merge(name, 1L, Long::sum);
            }
        }
        m.put("assigneePending", devNamed);

        return m;
    }

    @Transactional(readOnly = true)
    public Map<String, Long> versionRemainCount() {
        Map<String, Long> result = new HashMap<>();
        investigationMapper.selectList(null).forEach(v -> {
            if (v.getVersionName() != null
                    && !"NO_ISSUE".equals(v.getStatus()) && !"FIXED".equals(v.getStatus())) {
                result.merge(v.getVersionName(), 1L, Long::sum);
            }
        });
        return result;
    }
}
