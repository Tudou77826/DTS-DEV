package com.dts.domain;

import java.util.List;

/**
 * 问题状态与流转规则常量。
 */
public final class IssueStatus {

    private IssueStatus() {}

    // 主状态
    public static final String PENDING_ASSIGN = "PENDING_ASSIGN";     // 待分配
    public static final String PENDING_LOCATE = "PENDING_LOCATE";     // 待定位
    public static final String LOCATING = "LOCATING";                 // 定位中
    public static final String PENDING_VERIFY = "PENDING_VERIFY";     // 待验证
    public static final String RESOLVED = "RESOLVED";                 // 已解决
    public static final String CLOSED = "CLOSED";                     // 已关闭

    // 辅助状态
    public static final String NEED_INFO = "NEED_INFO";               // 待补充信息
    public static final String DEFERRED = "DEFERRED";                 // 暂缓处理
    public static final String CANNOT_REPRODUCE = "CANNOT_REPRODUCE"; // 无法复现
    public static final String WONT_FIX = "WONT_FIX";                 // 无须处理
    public static final String REOPENED = "REOPENED";                 // 重新打开

    /** 所有状态 */
    public static final List<String> ALL = List.of(
            PENDING_ASSIGN, PENDING_LOCATE, LOCATING, PENDING_VERIFY, RESOLVED, CLOSED,
            NEED_INFO, DEFERRED, CANNOT_REPRODUCE, WONT_FIX, REOPENED);

    /** 未关闭（活跃）状态 */
    public static final List<String> ACTIVE = List.of(
            PENDING_ASSIGN, PENDING_LOCATE, LOCATING, PENDING_VERIFY,
            NEED_INFO, DEFERRED, CANNOT_REPRODUCE, WONT_FIX, REOPENED);

    /** 已终结 */
    public static final List<String> TERMINAL = List.of(RESOLVED, CLOSED);

    public static boolean isValid(String status) {
        return status != null && ALL.contains(status);
    }
}
