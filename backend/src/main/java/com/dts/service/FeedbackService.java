package com.dts.service;

import com.baomidou.mybatisplus.core.toolkit.Wrappers;
import com.dts.common.BusinessException;
import com.dts.domain.Feedback;
import com.dts.domain.User;
import com.dts.mapper.FeedbackMapper;
import com.dts.security.LoginUser;
import com.dts.security.SecurityUtil;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;

/** 使用反馈：用户提交，管理员（共享密码门禁）查看与处理。 */
@Slf4j
@Service
@RequiredArgsConstructor
public class FeedbackService {

    public static final String STATUS_OPEN = "OPEN";
    public static final String STATUS_PROCESSED = "PROCESSED";

    private final FeedbackMapper feedbackMapper;
    private final ContentSanitizer sanitizer;
    private final NotificationService notificationService;

    @Transactional
    public Feedback submit(String content) {
        String html = sanitizer.richText(content);
        if (!sanitizer.hasText(html)) throw new BusinessException("反馈内容不能为空");
        LoginUser me = SecurityUtil.current();
        Feedback feedback = Feedback.builder()
                .userId(me.getId())
                .content(html)
                .status(STATUS_OPEN)
                .build();
        feedbackMapper.insert(feedback);
        return feedback;
    }

    public List<Feedback> listMine() {
        Long userId = SecurityUtil.currentUserId();
        return feedbackMapper.selectList(Wrappers.<Feedback>lambdaQuery()
                .eq(Feedback::getUserId, userId)
                .orderByDesc(Feedback::getCreatedAt));
    }

    /** 全部反馈（含处理人姓名），仅项目负责人 / 管理员可查看。 */
    public List<Feedback> listAll() {
        requireHandler();
        return feedbackMapper.selectList(Wrappers.<Feedback>lambdaQuery()
                .orderByDesc(Feedback::getCreatedAt));
    }

    @Transactional
    public Feedback process(Long id, String reply) {
        requireHandler();
        LoginUser me = SecurityUtil.current();
        Feedback feedback = feedbackMapper.selectById(id);
        if (feedback == null) throw new BusinessException("反馈不存在: " + id);
        String plainReply = sanitizer.plainText(reply);
        feedback.setReply(plainReply == null || plainReply.isBlank() ? null : plainReply);
        feedback.setStatus(STATUS_PROCESSED);
        feedback.setHandledBy(me.getId());
        feedback.setHandledAt(LocalDateTime.now());
        feedbackMapper.updateById(feedback);
        // 处理结果通知提交人
        if (feedback.getUserId() != null) {
            notificationService.notifyUsers(List.of(feedback.getUserId()), "FEEDBACK",
                    "你的反馈已被处理", plainReply == null || plainReply.isBlank()
                            ? "已处理" : plainReply, "/feedback");
        }
        return feedback;
    }

    private void requireHandler() {
        if (!SecurityUtil.isAdmin()) {
            throw new BusinessException(403, "仅管理员可查看/处理反馈");
        }
    }

    /** 反馈列表附带提交人/处理人名称的视图。 */
    public static FeedbackVo toVo(Feedback feedback, LookupService lookup) {
        FeedbackVo vo = new FeedbackVo();
        vo.setId(feedback.getId());
        vo.setUserId(feedback.getUserId());
        vo.setUserName(lookup.userName(feedback.getUserId()));
        vo.setContent(feedback.getContent());
        vo.setStatus(feedback.getStatus());
        vo.setHandledBy(feedback.getHandledBy());
        vo.setHandlerName(feedback.getHandledBy() == null ? null : lookup.userName(feedback.getHandledBy()));
        vo.setHandledAt(feedback.getHandledAt());
        vo.setReply(feedback.getReply());
        vo.setCreatedAt(feedback.getCreatedAt());
        return vo;
    }

    @lombok.Data
    public static class FeedbackVo {
        private Long id;
        private Long userId;
        private String userName;
        private String content;
        private String status;
        private Long handledBy;
        private String handlerName;
        private LocalDateTime handledAt;
        private String reply;
        private LocalDateTime createdAt;
    }
}
