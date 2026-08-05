package com.dts.service;

import com.dts.common.BusinessException;
import com.dts.config.DtsCustomizationProperties;
import com.dts.domain.Issue;
import com.dts.security.LoginUser;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;

import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

/**
 * 问题流转权限矩阵测试：关闭/重开仅提交人，其余流转仅当前责任人。
 */
class IssuePermissionServiceTest {

    private IssuePermissionService permissionService;

    @BeforeEach
    void setUp() {
        DtsCustomizationProperties customization = new DtsCustomizationProperties();
        // 与默认配置一致的流转矩阵（dts-customization.yml）
        customization.getIssue().getTransitions().putAll(Map.of(
                "PENDING_LOCATE", List.of("LOCATING", "NEED_INFO", "DEFERRED"),
                "LOCATING", List.of("PENDING_VERIFY", "NEED_INFO", "DEFERRED", "CANNOT_REPRODUCE", "WONT_FIX"),
                "PENDING_VERIFY", List.of("RESOLVED", "LOCATING", "NEED_INFO"),
                "RESOLVED", List.of("CLOSED", "REOPENED"),
                "NEED_INFO", List.of("PENDING_LOCATE", "LOCATING"),
                "WONT_FIX", List.of("CLOSED"),
                "CANNOT_REPRODUCE", List.of("LOCATING", "CLOSED")));
        permissionService = new IssuePermissionService(customization);
    }

    @BeforeEach
    void clearSecurityContext() {
        SecurityContextHolder.clearContext();
    }

    private void login(Long id, String role) {
        LoginUser user = new LoginUser(id, "u" + id, "用户" + id, role, "E" + id, "#000000");
        SecurityContextHolder.getContext().setAuthentication(
                new UsernamePasswordAuthenticationToken(user, null, user.getAuthorities()));
    }

    private Issue issue(String status, Long submitterId, Long assigneeId) {
        Issue issue = new Issue();
        issue.setStatus(status);
        issue.setSubmitterId(submitterId);
        issue.setAssigneeId(assigneeId);
        return issue;
    }

    @Test
    void submitterCanCloseResolvedIssue() {
        login(1L, "SUBMITTER");
        Issue resolved = issue("RESOLVED", 1L, 2L);
        assertDoesNotThrow(() -> permissionService.requireTransition(resolved, "CLOSED", null));
    }

    @Test
    void nonSubmitterCannotCloseResolvedIssue() {
        login(2L, "DEVELOPER");
        Issue resolved = issue("RESOLVED", 1L, 2L);
        BusinessException error = assertThrows(BusinessException.class,
                () -> permissionService.requireTransition(resolved, "CLOSED", null));
        assertEquals(403, error.getCode());
    }

    @Test
    void assigneeCanTransitionActiveStatus() {
        login(2L, "DEVELOPER");
        Issue locating = issue("PENDING_LOCATE", 1L, 2L);
        assertDoesNotThrow(() -> permissionService.requireTransition(locating, "LOCATING", null));
    }

    @Test
    void nonAssigneeCannotTransitionActiveStatus() {
        login(3L, "DEVELOPER");
        Issue locating = issue("PENDING_LOCATE", 1L, 2L);
        BusinessException error = assertThrows(BusinessException.class,
                () -> permissionService.requireTransition(locating, "LOCATING", null));
        assertEquals(403, error.getCode());
    }

    @Test
    void needInfoRequiresRemark() {
        login(2L, "DEVELOPER");
        Issue locating = issue("LOCATING", 1L, 2L);
        assertThrows(BusinessException.class,
                () -> permissionService.requireTransition(locating, "NEED_INFO", null));
        assertThrows(BusinessException.class,
                () -> permissionService.requireTransition(locating, "NEED_INFO", "  "));
        assertDoesNotThrow(() -> permissionService.requireTransition(locating, "NEED_INFO", "需要补充日志"));
    }

    @Test
    void pendingVerifyRequiresRootCause() {
        login(2L, "DEVELOPER");
        Issue locating = issue("LOCATING", 1L, 2L);
        assertThrows(BusinessException.class,
                () -> permissionService.requireTransition(locating, "PENDING_VERIFY", null));
        locating.setRootCause("DNS 解析超时");
        assertDoesNotThrow(() -> permissionService.requireTransition(locating, "PENDING_VERIFY", null));
    }

    @Test
    void resolveRequiresRootCauseAndResolution() {
        login(2L, "DEVELOPER");
        Issue pendingVerify = issue("PENDING_VERIFY", 1L, 2L);
        assertThrows(BusinessException.class,
                () -> permissionService.requireTransition(pendingVerify, "RESOLVED", null));
        pendingVerify.setRootCause("配置下发顺序错误");
        assertThrows(BusinessException.class,
                () -> permissionService.requireTransition(pendingVerify, "RESOLVED", null));
        pendingVerify.setResolution("调整下发顺序并验证通过");
        assertDoesNotThrow(() -> permissionService.requireTransition(pendingVerify, "RESOLVED", null));
    }

    @Test
    void transitionWithoutAssigneeIsRejected() {
        login(2L, "DEVELOPER");
        Issue unassigned = issue("PENDING_ASSIGN", 1L, null);
        assertThrows(BusinessException.class,
                () -> permissionService.requireTransition(unassigned, "LOCATING", null));
    }

    @Test
    void transitionNotInMatrixIsRejected() {
        login(2L, "DEVELOPER");
        Issue pendingLocate = issue("PENDING_LOCATE", 1L, 2L);
        // PENDING_LOCATE 不允许直接到 RESOLVED
        assertThrows(BusinessException.class,
                () -> permissionService.requireTransition(pendingLocate, "RESOLVED", null));
    }

    @Test
    void sameStatusTransitionIsNoop() {
        login(2L, "DEVELOPER");
        Issue locating = issue("LOCATING", 1L, 2L);
        assertDoesNotThrow(() -> permissionService.requireTransition(locating, "LOCATING", null));
    }
}
