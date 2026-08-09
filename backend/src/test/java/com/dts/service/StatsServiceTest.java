package com.dts.service;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.core.MybatisConfiguration;
import com.baomidou.mybatisplus.core.metadata.TableInfoHelper;
import com.dts.domain.Issue;
import com.dts.mapper.IssueMapper;
import com.dts.mapper.VersionInvestigationMapper;
import org.apache.ibatis.builder.MapperBuilderAssistant;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * 统计看板聚合测试：模块/子模块过滤条件、各统计口径。
 */
class StatsServiceTest {

    private IssueMapper issueMapper;
    private StatsService statsService;

    @BeforeEach
    void setUp() {
        // 单测无 mapper 扫描，需手动初始化 TableInfo 供 LambdaQueryWrapper 使用
        TableInfoHelper.initTableInfo(new MapperBuilderAssistant(new MybatisConfiguration(), ""), Issue.class);
        issueMapper = mock(IssueMapper.class);
        LookupService lookup = mock(LookupService.class);
        when(lookup.moduleName(1L)).thenReturn("模块A");
        when(lookup.subModuleName(2L)).thenReturn("子模块B");
        when(lookup.userName(9L)).thenReturn("张三");
        statsService = new StatsService(issueMapper, mock(VersionInvestigationMapper.class), lookup);
    }

    private Issue issue(long id, String status, Long moduleId, Long subModuleId, Long assigneeId,
                        LocalDateTime createdAt, LocalDateTime planFinishAt) {
        Issue issue = Issue.builder()
                .status(status).moduleId(moduleId).subModuleId(subModuleId)
                .assigneeId(assigneeId).planFinishAt(planFinishAt)
                .build();
        issue.setId(id);
        issue.setCreatedAt(createdAt);
        return issue;
    }

    @Test
    void filtersByModuleAndSubModule() {
        when(issueMapper.selectList(any(LambdaQueryWrapper.class))).thenReturn(List.of());

        statsService.overview(3L, 4L);

        org.mockito.ArgumentCaptor<LambdaQueryWrapper<Issue>> captor =
                org.mockito.ArgumentCaptor.forClass(LambdaQueryWrapper.class);
        verify(issueMapper).selectList(captor.capture());
        String sql = captor.getValue().getExpression().getNormal().getSqlSegment();
        assertEquals(true, sql.contains("module_id"));
        assertEquals(true, sql.contains("sub_module_id"));
    }

    @Test
    void noFilterWhenNull() {
        when(issueMapper.selectList(any(LambdaQueryWrapper.class))).thenReturn(List.of());
        statsService.overview(null, null);
        org.mockito.ArgumentCaptor<LambdaQueryWrapper<Issue>> captor =
                org.mockito.ArgumentCaptor.forClass(LambdaQueryWrapper.class);
        verify(issueMapper).selectList(captor.capture());
        assertTrue(captor.getValue().getExpression().getNormal().getSqlSegment().isBlank(),
                "无过滤条件时 sql 片段应为空");
    }

    @Test
    void aggregatesAllMetrics() {
        LocalDateTime now = LocalDateTime.now();
        List<Issue> issues = List.of(
                issue(1L, "PROCESSING", 1L, 2L, 9L, now, null),      // 今日新增、未关闭、待处理
                issue(2L, "RESOLVED", 1L, 2L, null, now.minusDays(2), null), // 已解决（终态）
                issue(3L, "CLOSED", null, null, null, now.minusDays(3), null), // 已关闭
                issue(4L, "PENDING_ASSIGN", null, null, null, now.minusDays(1),
                        now.minusDays(1)));                            // 超期、未分配
        when(issueMapper.selectList(any(LambdaQueryWrapper.class))).thenReturn(issues);

        Map<String, Object> stats = statsService.overview(null, null);

        assertEquals(4, stats.get("total"));
        assertEquals(1L, stats.get("todayNew"));
        assertEquals(2L, stats.get("resolved"));      // RESOLVED + CLOSED
        assertEquals(3L, stats.get("unclosed"));      // 除 CLOSED 外的 3 条
        assertEquals(3L, stats.get("unassigned"));    // 2/3/4 无 assignee
        assertEquals(1L, stats.get("overdue"));       // 第 4 条超期且状态为 ACTIVE

        @SuppressWarnings("unchecked")
        Map<String, Long> statusDist = (Map<String, Long>) stats.get("statusDist");
        assertEquals(1L, statusDist.get("PROCESSING"));
        assertEquals(1L, statusDist.get("RESOLVED"));

        @SuppressWarnings("unchecked")
        Map<String, Long> moduleDist = (Map<String, Long>) stats.get("moduleDist");
        assertEquals(2L, moduleDist.get("模块A"));

        @SuppressWarnings("unchecked")
        Map<String, Long> subModuleDist = (Map<String, Long>) stats.get("subModuleDist");
        assertEquals(2L, subModuleDist.get("子模块B"));

        @SuppressWarnings("unchecked")
        Map<String, Long> assigneePending = (Map<String, Long>) stats.get("assigneePending");
        assertEquals(1L, assigneePending.get("张三"));
    }
}
