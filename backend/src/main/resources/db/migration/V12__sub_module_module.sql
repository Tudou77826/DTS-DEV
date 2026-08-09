-- 子模块归属模块：cfg_sub_module 增加 module_id（子模块确定后所属模块随之确定）
ALTER TABLE cfg_sub_module
    ADD COLUMN module_id BIGINT NULL AFTER name;

-- 存量数据按同名模块回填
UPDATE cfg_sub_module sm
LEFT JOIN cfg_module m ON m.name = sm.name
SET sm.module_id = m.id
WHERE sm.module_id IS NULL;
