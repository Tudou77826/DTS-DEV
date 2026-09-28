package com.dts.service;

import com.baomidou.mybatisplus.core.toolkit.Wrappers;
import com.dts.common.BusinessException;
import com.dts.domain.Issue;
import com.dts.domain.Notification;
import com.dts.mapper.NotificationMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Map;

/** 接收 AI 服务的定向提问，复用 DTS 的站内通知。 */
@Service
@RequiredArgsConstructor
public class AiLocationNotificationService {
    private final IssueService issues;
    private final NotificationMapper notifications;

    @Transactional
    public void notifyQuestion(Map<String, Object> body) {
        Long issueId = Long.valueOf(String.valueOf(body.get("issueId")));
        Long targetId = Long.valueOf(String.valueOf(body.get("targetUserId")));
        String questionId = String.valueOf(body.get("id"));
        Issue issue = issues.get(issueId);
        if (!targetId.equals(issue.getSubmitterId()) && !targetId.equals(issue.getAssigneeId())) {
            throw new BusinessException(400, "提问接收人不是问题参与人");
        }
        String link = "/issues/" + issueId + "?aiQuestion=" + questionId;
        if (notifications.selectCount(Wrappers.<Notification>lambdaQuery()
                .eq(Notification::getType, "AI_QUESTION").eq(Notification::getLink, link)
                .eq(Notification::getUserId, targetId)) == 0) {
            notifications.insert(Notification.builder()
                    .userId(targetId).type("AI_QUESTION")
                    .title("AI 请求补充：" + issue.getCode())
                    .content(String.valueOf(body.get("text")))
                    .link(link).build());
        }
    }
}
