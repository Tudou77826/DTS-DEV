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
            throw new BusinessException(403, "仅项目负责人或管理员可执行该操作");
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
        throw new BusinessException(403, "仅问题参与人、项目负责人或管理员可执行该操作");
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
        if (IssueStatus.CLOSED.equals(newStatus) || IssueStatus.REOPENED.equals(newStatus)) {
            if (!user.isAdmin() && !user.getId().equals(issue.getSubmitterId())) {
                throw new BusinessException(403, "仅问题提出人或管理员可关闭/重新打开问题");
            }
        } else if (!user.isAdmin() && !user.getId().equals(issue.getAssigneeId())) {
            throw new BusinessException(403, "仅当前责任人或管理员可执行该状态流转");
        }

        if (!IssueStatus.PENDING_ASSIGN.equals(newStatus)
                && !IssueStatus.CLOSED.equals(newStatus)
                && !IssueStatus.REOPENED.equals(newStatus)
                && issue.getAssigneeId() == null) {
            throw new BusinessException("流转前必须先指定责任人");
        }
        if ((IssueStatus.NEED_INFO.equals(newStatus)
                || IssueStatus.DEFERRED.equals(newStatus)
                || IssueStatus.CANNOT_REPRODUCE.equals(newStatus)
                || IssueStatus.WONT_FIX.equals(newStatus)
                || IssueStatus.REOPENED.equals(newStatus))
                && (remark == null || remark.isBlank())) {
            throw new BusinessException("该状态流转必须填写说明");
        }
        if (IssueStatus.PENDING_VERIFY.equals(newStatus)
                && (issue.getRootCause() == null || issue.getRootCause().isBlank())) {
            throw new BusinessException("进入待验证前必须填写根本原因");
        }
        if (IssueStatus.RESOLVED.equals(newStatus)
                && ((issue.getRootCause() == null || issue.getRootCause().isBlank())
                || (issue.getResolution() == null || issue.getResolution().isBlank()))) {
            throw new BusinessException("解决问题前必须填写根本原因和处理结论");
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
