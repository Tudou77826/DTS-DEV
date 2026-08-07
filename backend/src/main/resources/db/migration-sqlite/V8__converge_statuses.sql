-- 状态收敛：把旧 11 个状态映射到新的 5 个主线状态
-- 待定位/定位中/待补充信息/暂缓处理/重新打开 → 处理中(PROCESSING)
-- 无法复现/无须处理 → 已解决(RESOLVED)
UPDATE issue
SET status = 'PROCESSING'
WHERE status IN ('PENDING_LOCATE', 'LOCATING', 'NEED_INFO', 'DEFERRED', 'REOPENED');

UPDATE issue
SET status = 'RESOLVED'
WHERE status IN ('CANNOT_REPRODUCE', 'WONT_FIX');
