CREATE TABLE issue_attachment (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    issue_id      INTEGER NOT NULL,
    uploader_id   INTEGER NOT NULL,
    source_type   TEXT NOT NULL,
    source_id     INTEGER,
    original_name TEXT NOT NULL,
    stored_name   TEXT NOT NULL,
    content_type  TEXT,
    file_size     INTEGER NOT NULL,
    storage_path  TEXT NOT NULL,
    created_at    TEXT NOT NULL DEFAULT (datetime('now','localtime')),
    updated_at    TEXT NOT NULL DEFAULT (datetime('now','localtime'))
);
CREATE INDEX idx_attachment_issue ON issue_attachment(issue_id);
CREATE INDEX idx_attachment_source ON issue_attachment(source_type, source_id);

CREATE TABLE notification (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id    INTEGER NOT NULL,
    type       TEXT NOT NULL,
    title      TEXT NOT NULL,
    content    TEXT,
    link       TEXT,
    read_at    TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now','localtime')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
);
CREATE INDEX idx_notification_user_read ON notification(user_id, read_at);
CREATE INDEX idx_notification_created ON notification(created_at);

CREATE TABLE issue_relation (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    source_issue_id INTEGER NOT NULL,
    target_issue_id INTEGER NOT NULL,
    relation_type   TEXT NOT NULL,
    created_by      INTEGER NOT NULL,
    created_at      TEXT NOT NULL DEFAULT (datetime('now','localtime')),
    updated_at      TEXT NOT NULL DEFAULT (datetime('now','localtime')),
    UNIQUE(source_issue_id, target_issue_id, relation_type)
);
CREATE INDEX idx_relation_target ON issue_relation(target_issue_id);
