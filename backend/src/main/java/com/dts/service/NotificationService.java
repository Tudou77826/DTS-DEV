package com.dts.service;

import com.baomidou.mybatisplus.core.toolkit.Wrappers;
import com.dts.domain.Notification;
import com.dts.mapper.NotificationMapper;
import com.dts.security.SecurityUtil;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.Collection;
import java.util.LinkedHashSet;
import java.util.List;

@Service
@RequiredArgsConstructor
public class NotificationService {

    private final NotificationMapper notificationMapper;
    private final com.dts.mapper.UserMapper userMapper;
    private final FeatureGuard featureGuard;

    @Transactional
    public void notifyUsers(Collection<Long> userIds, String type, String title, String content, String link) {
        if (userIds == null || !featureGuard.enabled("notifications")) return;
        Long current = SecurityUtil.currentUserId();
        for (Long userId : new LinkedHashSet<>(userIds)) {
            if (userId == null || userId.equals(current)) continue;
            notificationMapper.insert(Notification.builder()
                    .userId(userId)
                    .type(type)
                    .title(title)
                    .content(content)
                    .link(link)
                    .build());
        }
    }

    public List<Notification> latest() {
        return notificationMapper.selectList(Wrappers.<Notification>lambdaQuery()
                .eq(Notification::getUserId, SecurityUtil.currentUserId())
                .orderByDesc(Notification::getCreatedAt)
                .last("LIMIT 50"));
    }

    public long unreadCount() {
        return notificationMapper.selectCount(Wrappers.<Notification>lambdaQuery()
                .eq(Notification::getUserId, SecurityUtil.currentUserId())
                .isNull(Notification::getReadAt));
    }

    /** 项目负责人（LEADER）的用户 ID 列表，用于站内反馈等需要知会负责人的场景。 */
    public List<Long> leaderUserIds() {
        return userMapper.selectList(Wrappers.<com.dts.domain.User>lambdaQuery()
                        .eq(com.dts.domain.User::getRole, "LEADER")
                        .eq(com.dts.domain.User::getActive, true))
                .stream().map(com.dts.domain.User::getId).toList();
    }

    @Transactional
    public void markRead(Long id) {
        notificationMapper.update(null, Wrappers.<Notification>lambdaUpdate()
                .eq(Notification::getId, id)
                .eq(Notification::getUserId, SecurityUtil.currentUserId())
                .set(Notification::getReadAt, LocalDateTime.now()));
    }

    @Transactional
    public void markAllRead() {
        notificationMapper.update(null, Wrappers.<Notification>lambdaUpdate()
                .eq(Notification::getUserId, SecurityUtil.currentUserId())
                .isNull(Notification::getReadAt)
                .set(Notification::getReadAt, LocalDateTime.now()));
    }
}
