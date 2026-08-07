package com.dts.domain;

import java.util.List;

/**
 * 问题状态与流转规则常量。
 *
 * <p>状态收敛为 5 个主线状态：
 * 待分配 → 处理中 → 待验证 → 已解决 → 已关闭。
 * 原 待定位/定位中/待补充信息/暂缓处理/重新打开 合并为 处理中，
 * 原 无法复现/无须处理 归入 已解决（走非问题结论路径）。
 */
public final class IssueStatus {

    private IssueStatus() {}

    public static final String PENDING_ASSIGN = "PENDING_ASSIGN";     // 待分配
    public static final String PROCESSING = "PROCESSING";             // 处理中
    public static final String PENDING_VERIFY = "PENDING_VERIFY";     // 待验证
    public static final String RESOLVED = "RESOLVED";                 // 已解决
    public static final String CLOSED = "CLOSED";                     // 已关闭

    /** 所有状态 */
    public static final List<String> ALL = List.of(
            PENDING_ASSIGN, PROCESSING, PENDING_VERIFY, RESOLVED, CLOSED);

    /** 未关闭（活跃）状态 */
    public static final List<String> ACTIVE = List.of(
            PENDING_ASSIGN, PROCESSING, PENDING_VERIFY);

    /** 已终结 */
    public static final List<String> TERMINAL = List.of(RESOLVED, CLOSED);

    /** 旧状态 → 新状态的存量数据映射（V8 迁移使用） */
    public static final java.util.Map<String, String> LEGACY_MAPPING = java.util.Map.ofEntries(
            java.util.Map.entry("PENDING_LOCATE", PROCESSING),
            java.util.Map.entry("LOCATING", PROCESSING),
            java.util.Map.entry("NEED_INFO", PROCESSING),
            java.util.Map.entry("DEFERRED", PROCESSING),
            java.util.Map.entry("REOPENED", PROCESSING),
            java.util.Map.entry("CANNOT_REPRODUCE", RESOLVED),
            java.util.Map.entry("WONT_FIX", RESOLVED));

    public static boolean isValid(String status) {
        return status != null && ALL.contains(status);
    }
}
