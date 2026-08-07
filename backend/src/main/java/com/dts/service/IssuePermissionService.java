package com.dts.service;

import com.dts.common.BusinessException;
import com.dts.config.DtsCustomizationProperties;
import com.dts.domain.Issue;
import com.dts.domain.IssueStatus;
import com.dts.security.LoginUser;
import com.dts.security.SecurityUtil;
import org.springframework.stereotype.Service;
import lombok.RequiredArgsConstructor;

import java.util.HashSet;
import java.util.Set;

/** 问题流转和操作权限的唯一校验入口。 */
@Service
@RequiredArgsConstructor
public class IssuePermissionService {

    private final DtsCustomizationProperties customization;

    public void requireLeader() {
        if (!SecurityUtil.current().isLeader()) {
            throw new BusinessException(403, "仅项目负责人可执行该操作");
        }
    }

    public void requireParticipantOrLeader(Issue issue) {
        LoginUser user = SecurityUtil.current();
        if (user.isLeader()
                || user.getId().equals(issue.getSubmitterId())
                || user.getId().equals(issue.getAssigneeId())
                || containsId(issue.getCollaboratorIds(), user.getId())) {
            return;
        }
        throw new BusinessException(403, "仅问题参与人或项目负责人可执行该操作");
    }

    public void requireTransition(Issue issue, String newStatus, String remark) {
        if (!IssueStatus.isValid(newStatus)) {
            throw new BusinessException("非法状态: " + newStatus);
        }
        if (newStatus.equals(issue.getStatus())) return;
        Set<String> allowed = new HashSet<>(customization.getIssue().getTransitions()
                .getOrDefault(issue.getStatus(), java.util.List.of()));
        if (!allowed.contains(newStatus)) {
            throw new BusinessException("不允许从 " + issue.getStatus() + " 流转到 " + newStatus);
        }

        LoginUser user = SecurityUtil.current();
        boolean isAdmin = SecurityUtil.isAdmin();
        // 关闭 / 重新打开（从已解决/已关闭退回处理中）仅问题提出人，管理员可越权
        boolean closeOrReopen = IssueStatus.CLOSED.equals(newStatus)
                || (IssueStatus.PROCESSING.equals(newStatus)
                    && IssueStatus.TERMINAL.contains(issue.getStatus()));
        if (closeOrReopen) {
            if (!isAdmin && !user.getId().equals(issue.getSubmitterId())) {
                throw new BusinessException(403, "仅问题提出人可关闭/重新打开问题");
            }
        } else if (!isAdmin && !user.getId().equals(issue.getAssigneeId())) {
            throw new BusinessException(403, "仅当前责任人可执行该状态流转");
        }

        if (!IssueStatus.PENDING_ASSIGN.equals(newStatus)
                && !IssueStatus.CLOSED.equals(newStatus)
                && issue.getAssigneeId() == null) {
            throw new BusinessException("流转前必须先指定责任人");
        }
        // 已解决（开发标注）：必填处理描述 + 是问题/非问题标注
        if (IssueStatus.RESOLVED.equals(newStatus)) {
            if (remark == null || remark.isBlank()) {
                throw new BusinessException("转为已解决前必须填写处理描述");
            }
            validateIssueFlag(issue);
            if ("NON_PROBLEM".equals(issue.getIssueFlag())
                    && (issue.getResolution() == null || issue.getResolution().isBlank())) {
                throw new BusinessException("已标注为非问题，请填写处理结论");
            }
        }
        // 已关闭（提出人复核标注）：必填是问题/非问题标注
        if (IssueStatus.CLOSED.equals(newStatus)) {
            validateIssueFlag(issue);
        }
    }

    /**
     * 是问题/非问题标注校验：标注必填；标注为「是问题」时 DTS 系统问题单号必填。
     */
    private void validateIssueFlag(Issue issue) {
        String flag = issue.getIssueFlag();
        if (!"PROBLEM".equals(flag) && !"NON_PROBLEM".equals(flag)) {
            throw new BusinessException("请先标注该事项是系统问题还是非问题");
        }
        if ("PROBLEM".equals(flag)
                && (issue.getDtsTicketNo() == null || issue.getDtsTicketNo().isBlank())) {
            throw new BusinessException("已标注为系统问题，请填写 DTS 系统问题单号");
        }
    }

    private boolean containsId(String csv, Long id) {
        if (csv == null || csv.isBlank()) return false;
        String needle = String.valueOf(id);
        for (String value : csv.split(",")) {
            if (needle.equals(value.trim())) return true;
        }
        return false;
    }
}
