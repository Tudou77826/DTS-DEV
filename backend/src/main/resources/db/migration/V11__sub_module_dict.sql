-- 子模块字典化：cfg_sub_module + issue.sub_module_id + sys_user.sub_module_id
CREATE TABLE cfg_sub_module (
    id          BIGINT NOT NULL AUTO_INCREMENT,
    name        VARCHAR(64) NOT NULL,
    active      TINYINT NOT NULL DEFAULT 1,
    created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uk_sub_module_name (name)
);

-- 问题归属子模块（分类标签，处理人/负责人可流转）
ALTER TABLE issue
    ADD COLUMN sub_module_id BIGINT NULL AFTER sub_module;

-- 用户归属子模块（开发/负责人，用于列表自动筛选）
ALTER TABLE sys_user
    ADD COLUMN sub_module_id BIGINT NULL AFTER team_id;
