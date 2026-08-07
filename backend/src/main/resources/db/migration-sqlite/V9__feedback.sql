-- 站内反馈收集
CREATE TABLE sys_feedback (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id      INTEGER NOT NULL,
    content      TEXT NOT NULL,
    status       TEXT NOT NULL DEFAULT 'OPEN',
    handled_by   INTEGER,
    handled_at   TEXT,
    reply        TEXT,
    created_at   TEXT NOT NULL DEFAULT (datetime('now','localtime')),
    updated_at   TEXT NOT NULL DEFAULT (datetime('now','localtime'))
);
CREATE INDEX idx_feedback_user ON sys_feedback(user_id);
CREATE INDEX idx_feedback_status ON sys_feedback(status);
