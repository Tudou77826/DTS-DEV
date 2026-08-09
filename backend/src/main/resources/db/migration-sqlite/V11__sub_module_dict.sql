-- 子模块字典化：cfg_sub_module + issue.sub_module_id + sys_user.sub_module_id
CREATE TABLE cfg_sub_module (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    name        TEXT NOT NULL,
    active      INTEGER NOT NULL DEFAULT 1,
    created_at  TEXT NOT NULL DEFAULT (datetime('now','localtime')),
    updated_at  TEXT NOT NULL DEFAULT (datetime('now','localtime'))
);
CREATE UNIQUE INDEX uk_sub_module_name ON cfg_sub_module(name);

-- 问题归属子模块（分类标签，处理人/负责人可流转）
ALTER TABLE issue
    ADD COLUMN sub_module_id INTEGER;

-- 用户归属子模块（开发/负责人，用于列表自动筛选）
ALTER TABLE sys_user
    ADD COLUMN sub_module_id INTEGER;
