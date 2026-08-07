-- 状态二次收敛 + 是问题/非问题标注
-- 待验证 → 已解决（开发已完成、待提出人确认的语义并入已解决）
UPDATE issue
SET status = 'RESOLVED'
WHERE status = 'PENDING_VERIFY';

-- 新增「是问题/非问题」标注列：PROBLEM / NON_PROBLEM
ALTER TABLE issue
    ADD COLUMN issue_flag VARCHAR(16) NULL AFTER status;
