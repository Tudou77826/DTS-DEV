package com.dts.domain;

import java.util.List;
import java.util.Map;

/**
 * 问题状态与流转规则常量。
 *
 * <p>状态机（5 个）：
 * 待分配 → 待处理 → 处理中 → 已解决 → 已关闭。
 * <ul>
 *   <li>待分配 PENDING_ASSIGN：负责人未指派处理人</li>
 *   <li>待处理 PENDING_HANDLE：已指派处理人，开发尚未开始</li>
 *   <li>处理中 PROCESSING：开发已开始处理</li>
 *   <li>已解决 RESOLVED：开发完成，待提出人确认</li>
 *   <li>已关闭 CLOSED：提出人确认闭环（可从已解决/已关闭退回处理中重新打开）</li>
 * </ul>
 */
public final class IssueStatus {

    private IssueStatus() {}

    public static final String PENDING_ASSIGN = "PENDING_ASSIGN";     // 待分配
    public static final String PENDING_HANDLE = "PENDING_HANDLE";     // 待处理
    public static final String PROCESSING = "PROCESSING";             // 处理中
    public static final String RESOLVED = "RESOLVED";                 // 已解决
    public static final String CLOSED = "CLOSED";                     // 已关闭

    /** 所有状态 */
    public static final List<String> ALL = List.of(
            PENDING_ASSIGN, PENDING_HANDLE, PROCESSING, RESOLVED, CLOSED);

    /** 未关闭（活跃）状态 */
    public static final List<String> ACTIVE = List.of(
            PENDING_ASSIGN, PENDING_HANDLE, PROCESSING);

    /** 已终结 */
    public static final List<String> TERMINAL = List.of(RESOLVED, CLOSED);

    /** 旧状态 → 新状态的存量数据映射（V8 迁移使用） */
    public static final Map<String, String> LEGACY_MAPPING = Map.ofEntries(
            Map.entry("PENDING_LOCATE", PENDING_HANDLE),
            Map.entry("LOCATING", PROCESSING),
            Map.entry("NEED_INFO", PROCESSING),
            Map.entry("DEFERRED", PROCESSING),
            Map.entry("REOPENED", PROCESSING),
            Map.entry("CANNOT_REPRODUCE", RESOLVED),
            Map.entry("WONT_FIX", RESOLVED),
            Map.entry("PENDING_VERIFY", RESOLVED));

    public static boolean isValid(String status) {
        return status != null && ALL.contains(status);
    }
}
