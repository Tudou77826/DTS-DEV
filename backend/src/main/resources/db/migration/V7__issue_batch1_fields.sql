-- 第一批优化字段：期望解决时间、子模块、DTS 系统问题单号
ALTER TABLE issue
    ADD COLUMN expected_finish_at DATETIME NULL AFTER plan_finish_at,
    ADD COLUMN sub_module VARCHAR(255) NULL AFTER module_id,
    ADD COLUMN dts_ticket_no VARCHAR(64) NULL AFTER sub_module;
