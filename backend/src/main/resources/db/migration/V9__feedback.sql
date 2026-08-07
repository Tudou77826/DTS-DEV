-- 站内反馈收集
CREATE TABLE sys_feedback (
    id           BIGINT NOT NULL AUTO_INCREMENT,
    user_id      BIGINT NOT NULL,
    content      MEDIUMTEXT NOT NULL,
    status       VARCHAR(32) NOT NULL DEFAULT 'OPEN',
    handled_by   BIGINT,
    handled_at   DATETIME,
    reply        TEXT,
    created_at   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    KEY idx_feedback_user (user_id),
    KEY idx_feedback_status (status)
);

-- 问题描述允许内嵌 base64 图片（与其他富文本能力保持一致）
ALTER TABLE issue
    MODIFY COLUMN description MEDIUMTEXT NOT NULL;
