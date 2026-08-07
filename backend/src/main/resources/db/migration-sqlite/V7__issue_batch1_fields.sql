-- 第一批优化字段：期望解决时间、子模块、DTS 系统问题单号
ALTER TABLE issue
    ADD COLUMN expected_finish_at TEXT;
ALTER TABLE issue
    ADD COLUMN sub_module TEXT;
ALTER TABLE issue
    ADD COLUMN dts_ticket_no TEXT;
