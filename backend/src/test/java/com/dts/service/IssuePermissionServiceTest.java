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
 * 待分配 → 待处理 → 处理中 → 已解决 → 已关闭。
 * 已解决/已关闭必须标注是问题或非问题；是问题必填 DTS 单号，非问题必填结论。
 */
class IssuePermissionServiceTest {

    private IssuePermissionService permissionService;

    @BeforeEach
    void setUp() {
        DtsCustomizationProperties customization = new DtsCustomizationProperties();
        // 与默认配置一致的流转矩阵（dts-customization.yml）
        customization.getIssue().getTransitions().putAll(Map.of(
                "PENDING_ASSIGN", List.of("PENDING_HANDLE"),
                "PENDING_HANDLE", List.of("PROCESSING"),
                "PROCESSING", List.of("RESOLVED", "PROCESSING"),
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

    // ─── 权限矩阵 ───

    @Test
    void submitterCanCloseResolvedIssue() {
        login(1L, "SUBMITTER");
        Issue resolved = issue("RESOLVED", 1L, 2L);
        resolved.setIssueFlag("PROBLEM");
        resolved.setDtsTicketNo("DTS-001");
        assertDoesNotThrow(() -> permissionService.requireTransition(resolved, "CLOSED", null));
    }

    @Test
    void nonSubmitterCannotCloseResolvedIssue() {
        login(2L, "DEVELOPER");
        Issue resolved = issue("RESOLVED", 1L, 2L);
        resolved.setIssueFlag("PROBLEM");
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
    void adminCanTransitionAnyStatus() {
        loginAdmin(3L, "SUBMITTER");
        Issue resolved = issue("RESOLVED", 1L, 2L);
        resolved.setIssueFlag("PROBLEM");
        resolved.setDtsTicketNo("DTS-ADMIN-001");
        assertDoesNotThrow(() -> permissionService.requireTransition(resolved, "CLOSED", null));
        Issue closed = issue("CLOSED", 1L, 2L);
        assertDoesNotThrow(() -> permissionService.requireTransition(closed, "PROCESSING", "管理员重新打开"));
    }

    @Test
    void assigneeCanStartProcessing() {
        login(2L, "DEVELOPER");
        Issue pendingHandle = issue("PENDING_HANDLE", 1L, 2L);
        assertDoesNotThrow(() -> permissionService.requireTransition(pendingHandle, "PROCESSING", null));
    }

    @Test
    void nonAssigneeCannotStartProcessing() {
        login(3L, "DEVELOPER");
        Issue pendingHandle = issue("PENDING_HANDLE", 1L, 2L);
        BusinessException error = assertThrows(BusinessException.class,
                () -> permissionService.requireTransition(pendingHandle, "PROCESSING", null));
        assertEquals(403, error.getCode());
    }

    @Test
    void transitionWithoutAssigneeIsRejected() {
        login(2L, "DEVELOPER");
        Issue unassigned = issue("PENDING_ASSIGN", 1L, null);
        assertThrows(BusinessException.class,
                () -> permissionService.requireTransition(unassigned, "PENDING_HANDLE", null));
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

    // ─── 已解决标注校验 ───

    @Test
    void resolveRequiresRemark() {
        login(2L, "DEVELOPER");
        Issue processing = issue("PROCESSING", 1L, 2L);
        processing.setIssueFlag("PROBLEM");
        BusinessException error = assertThrows(BusinessException.class,
                () -> permissionService.requireTransition(processing, "RESOLVED", null));
        assertEquals("转为已解决前必须填写处理描述", error.getMessage());
    }

    @Test
    void resolveRequiresFlagAnnotation() {
        login(2L, "DEVELOPER");
        Issue processing = issue("PROCESSING", 1L, 2L);
        BusinessException error = assertThrows(BusinessException.class,
                () -> permissionService.requireTransition(processing, "RESOLVED", "处理完成"));
        assertEquals("请先标注该事项是系统问题还是非问题", error.getMessage());
    }

    @Test
    void resolveAsProblemRequiresDtsTicket() {
        login(2L, "DEVELOPER");
        Issue processing = issue("PROCESSING", 1L, 2L);
        processing.setIssueFlag("PROBLEM");
        BusinessException error = assertThrows(BusinessException.class,
                () -> permissionService.requireTransition(processing, "RESOLVED", "处理完成"));
        assertEquals("已标注为系统问题，请填写 DTS 系统问题单号", error.getMessage());
        processing.setDtsTicketNo("DTS-2026-001");
        assertDoesNotThrow(() -> permissionService.requireTransition(processing, "RESOLVED", "处理完成"));
    }

    @Test
    void resolveAsNonProblemRequiresResolution() {
        login(2L, "DEVELOPER");
        Issue processing = issue("PROCESSING", 1L, 2L);
        processing.setIssueFlag("NON_PROBLEM");
        BusinessException error = assertThrows(BusinessException.class,
                () -> permissionService.requireTransition(processing, "RESOLVED", "处理完成"));
        assertEquals("已标注为非问题，请填写处理结论", error.getMessage());
        processing.setResolution("经排查为环境误报，非产品问题");
        assertDoesNotThrow(() -> permissionService.requireTransition(processing, "RESOLVED", "处理完成"));
    }

    // ─── 已关闭标注校验 ───

    @Test
    void closeRequiresFlagAnnotation() {
        login(1L, "SUBMITTER");
        Issue resolved = issue("RESOLVED", 1L, 2L);
        BusinessException error = assertThrows(BusinessException.class,
                () -> permissionService.requireTransition(resolved, "CLOSED", null));
        assertEquals("请先标注该事项是系统问题还是非问题", error.getMessage());
    }

    @Test
    void closeAsProblemRequiresDtsTicket() {
        login(1L, "SUBMITTER");
        Issue resolved = issue("RESOLVED", 1L, 2L);
        resolved.setIssueFlag("PROBLEM");
        BusinessException error = assertThrows(BusinessException.class,
                () -> permissionService.requireTransition(resolved, "CLOSED", null));
        assertEquals("已标注为系统问题，请填写 DTS 系统问题单号", error.getMessage());
        resolved.setDtsTicketNo("DTS-2026-002");
        assertDoesNotThrow(() -> permissionService.requireTransition(resolved, "CLOSED", null));
    }

    @Test
    void closeAsNonProblemSucceeds() {
        login(1L, "SUBMITTER");
        Issue resolved = issue("RESOLVED", 1L, 2L);
        resolved.setIssueFlag("NON_PROBLEM");
        assertDoesNotThrow(() -> permissionService.requireTransition(resolved, "CLOSED", null));
    }
}
