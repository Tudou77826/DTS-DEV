package com.dts.controller;

import com.dts.common.ApiResponse;
import com.dts.domain.Notification;
import com.dts.service.NotificationService;
import com.dts.service.FeatureGuard;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/notifications")
@RequiredArgsConstructor
public class NotificationController {

    private final NotificationService notificationService;
    private final FeatureGuard featureGuard;

    @GetMapping
    public ApiResponse<List<Notification>> latest() {
        featureGuard.requireEnabled("notifications", "站内通知");
        return ApiResponse.ok(notificationService.latest());
    }

    @GetMapping("/unread-count")
    public ApiResponse<Map<String, Long>> unreadCount() {
        featureGuard.requireEnabled("notifications", "站内通知");
        return ApiResponse.ok(Map.of("count", notificationService.unreadCount()));
    }

    @PatchMapping("/{id}/read")
    public ApiResponse<Void> markRead(@PathVariable Long id) {
        featureGuard.requireEnabled("notifications", "站内通知");
        notificationService.markRead(id);
        return ApiResponse.ok();
    }

    @PatchMapping("/read-all")
    public ApiResponse<Void> markAllRead() {
        featureGuard.requireEnabled("notifications", "站内通知");
        notificationService.markAllRead();
        return ApiResponse.ok();
    }
}
