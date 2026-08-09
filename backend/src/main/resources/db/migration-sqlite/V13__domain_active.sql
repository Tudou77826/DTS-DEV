-- 问题领域字典增加停用标记：支持“重启覆盖”时把 YAML 中不存在的领域停用（而非删除，避免破坏已引用该领域的问题）
ALTER TABLE cfg_issue_domain
    ADD COLUMN active INTEGER NOT NULL DEFAULT 1;
