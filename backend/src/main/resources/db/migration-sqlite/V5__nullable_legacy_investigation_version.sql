CREATE TABLE version_investigation_new (
    id               INTEGER PRIMARY KEY AUTOINCREMENT,
    issue_id         INTEGER NOT NULL,
    version_id       INTEGER,
    version_name     TEXT,
    investigator_id  INTEGER,
    status           TEXT NOT NULL,
    result           TEXT,
    handling_note    TEXT,
    fix_version_id   INTEGER,
    fix_version_name TEXT,
    verify_result    TEXT,
    completed_at     TEXT,
    created_at       TEXT NOT NULL DEFAULT (datetime('now','localtime')),
    updated_at       TEXT NOT NULL DEFAULT (datetime('now','localtime'))
);

INSERT INTO version_investigation_new (
    id, issue_id, version_id, version_name, investigator_id, status, result,
    handling_note, fix_version_id, fix_version_name, verify_result, completed_at,
    created_at, updated_at
)
SELECT
    id, issue_id, version_id, version_name, investigator_id, status, result,
    handling_note, fix_version_id, fix_version_name, verify_result, completed_at,
    created_at, updated_at
FROM version_investigation;

DROP TABLE version_investigation;
ALTER TABLE version_investigation_new RENAME TO version_investigation;

CREATE INDEX idx_invest_issue ON version_investigation(issue_id);
CREATE INDEX idx_invest_version ON version_investigation(version_id);
CREATE INDEX idx_invest_version_name ON version_investigation(version_name);
