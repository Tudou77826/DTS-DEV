package com.dts.service;

import com.dts.common.BusinessException;
import com.dts.config.DtsCustomizationProperties;
import com.dts.domain.Issue;
import com.dts.security.LoginUser;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;

import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

/**
 * 问题流转权限矩阵测试（5 个主线状态）：
 * 关闭/重新打开仅提交人（管理员可越权），其余流转仅当前责任人（管理员可越权）。
 */
class IssuePermissionServiceTest {

    private IssuePermissionService permissionService;

    @BeforeEach
    void setUp() {
        DtsCustomizationProperties customization = new DtsCustomizationProperties();
        // 与默认配置一致的流转矩阵（dts-customization.yml）
        customization.getIssue().getTransitions().putAll(Map.of(
                "PENDING_ASSIGN", List.of("PROCESSING"),
                "PROCESSING", List.of("PENDING_VERIFY", "PROCESSING"),
                "PENDING_VERIFY", List.of("RESOLVED", "PROCESSING"),
                "RESOLVED", List.of("CLOSED", "PROCESSING"),
                "CLOSED", List.of("PROCESSING")));
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

    private void loginAdmin(Long id, String role) {
        LoginUser user = new LoginUser(id, "u" + id, "用户" + id, role, "E" + id, "#000000");
        SecurityContextHolder.getContext().setAuthentication(
                new UsernamePasswordAuthenticationToken(user, null,
                        List.of(new SimpleGrantedAuthority("ROLE_" + role),
                                new SimpleGrantedAuthority("ROLE_ADMIN"))));
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
    void submitterCanReopenResolvedOrClosedIssue() {
        login(1L, "SUBMITTER");
        Issue resolved = issue("RESOLVED", 1L, 2L);
        assertDoesNotThrow(() -> permissionService.requireTransition(resolved, "PROCESSING", "复测仍复现"));
        Issue closed = issue("CLOSED", 1L, 2L);
        assertDoesNotThrow(() -> permissionService.requireTransition(closed, "PROCESSING", "重新打开"));
    }

    @Test
    void nonSubmitterCannotReopen() {
        login(2L, "DEVELOPER");
        Issue resolved = issue("RESOLVED", 1L, 2L);
        BusinessException error = assertThrows(BusinessException.class,
                () -> permissionService.requireTransition(resolved, "PROCESSING", "复测仍复现"));
        assertEquals(403, error.getCode());
    }

    @Test
    void adminCanTransitionAnyStatus() {
        loginAdmin(3L, "SUBMITTER");
        Issue resolved = issue("RESOLVED", 1L, 2L);
        assertDoesNotThrow(() -> permissionService.requireTransition(resolved, "CLOSED", null));
        Issue closed = issue("CLOSED", 1L, 2L);
        assertDoesNotThrow(() -> permissionService.requireTransition(closed, "PROCESSING", "管理员重新打开"));
    }

    @Test
    void assigneeCanTransitionActiveStatus() {
        login(2L, "DEVELOPER");
        Issue processing = issue("PROCESSING", 1L, 2L);
        processing.setRootCause("已定位到根因");
        assertDoesNotThrow(() -> permissionService.requireTransition(processing, "PENDING_VERIFY", null));
    }

    @Test
    void nonAssigneeCannotTransitionActiveStatus() {
        login(3L, "DEVELOPER");
        Issue processing = issue("PROCESSING", 1L, 2L);
        BusinessException error = assertThrows(BusinessException.class,
                () -> permissionService.requireTransition(processing, "PENDING_VERIFY", null));
        assertEquals(403, error.getCode());
    }

    @Test
    void pendingVerifyRequiresRootCause() {
        login(2L, "DEVELOPER");
        Issue processing = issue("PROCESSING", 1L, 2L);
        assertThrows(BusinessException.class,
                () -> permissionService.requireTransition(processing, "PENDING_VERIFY", null));
        processing.setRootCause("DNS 解析超时");
        assertDoesNotThrow(() -> permissionService.requireTransition(processing, "PENDING_VERIFY", null));
    }

    @Test
    void resolveRequiresRemarkAndTicketOrResolution() {
        login(2L, "DEVELOPER");
        Issue pendingVerify = issue("PENDING_VERIFY", 1L, 2L);
        // 无描述、无单号、无结论 → 拒绝
        BusinessException e1 = assertThrows(BusinessException.class,
                () -> permissionService.requireTransition(pendingVerify, "RESOLVED", null));
        assertEquals("转为已解决前必须填写处理描述", e1.getMessage());
        // 有描述但既无 DTS 单号也无结论 → 拒绝
        BusinessException e2 = assertThrows(BusinessException.class,
                () -> permissionService.requireTransition(pendingVerify, "RESOLVED", "处理完成"));
        assertEquals("转为已解决前必须填写 DTS 系统问题单号或处理结论：若为问题请填写 DTS 单号，非问题请填写结论", e2.getMessage());
        // 填写 DTS 单号 → 通过
        pendingVerify.setDtsTicketNo("DTS-2026-001");
        assertDoesNotThrow(() -> permissionService.requireTransition(pendingVerify, "RESOLVED", "处理完成"));
    }

    @Test
    void resolveRequiresTicketOrResolution() {
        login(2L, "DEVELOPER");
        Issue pendingVerify = issue("PENDING_VERIFY", 1L, 2L);
        // 有处理结论（非问题）而无 DTS 单号 → 通过
        pendingVerify.setResolution("经排查为环境误报，非产品问题");
        assertDoesNotThrow(() -> permissionService.requireTransition(pendingVerify, "RESOLVED", "已确认非问题"));
    }

    @Test
    void transitionWithoutAssigneeIsRejected() {
        login(2L, "DEVELOPER");
        Issue unassigned = issue("PENDING_ASSIGN", 1L, null);
        assertThrows(BusinessException.class,
                () -> permissionService.requireTransition(unassigned, "PROCESSING", null));
    }

    @Test
    void transitionNotInMatrixIsRejected() {
        login(2L, "DEVELOPER");
        Issue pendingAssign = issue("PENDING_ASSIGN", 1L, 2L);
        // 待分配不允许直接到已解决
        assertThrows(BusinessException.class,
                () -> permissionService.requireTransition(pendingAssign, "RESOLVED", null));
    }

    @Test
    void sameStatusTransitionIsNoop() {
        login(2L, "DEVELOPER");
        Issue processing = issue("PROCESSING", 1L, 2L);
        assertDoesNotThrow(() -> permissionService.requireTransition(processing, "PROCESSING", null));
    }
}
