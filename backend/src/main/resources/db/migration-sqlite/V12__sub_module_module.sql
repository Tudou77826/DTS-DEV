-- 子模块归属模块：cfg_sub_module 增加 module_id（子模块确定后所属模块随之确定）
ALTER TABLE cfg_sub_module
    ADD COLUMN module_id INTEGER;

-- 存量数据按同名模块回填
UPDATE cfg_sub_module
SET module_id = (SELECT m.id FROM cfg_module m WHERE m.name = cfg_sub_module.name)
WHERE module_id IS NULL;
