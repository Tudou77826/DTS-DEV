-- ============================================================
-- 问题管理平台 建表脚本（SQLite，本地验证用）
-- ============================================================

CREATE TABLE sys_user (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    employee_no     TEXT NOT NULL,
    username        TEXT NOT NULL,
    display_name    TEXT NOT NULL,
    password        TEXT NOT NULL,
    role            TEXT NOT NULL,
    email           TEXT,
    phone           TEXT,
    team_id         INTEGER,
    avatar_color    TEXT,
    active          INTEGER NOT NULL DEFAULT 1,
    created_at      TEXT NOT NULL DEFAULT (datetime('now','localtime')),
    updated_at      TEXT NOT NULL DEFAULT (datetime('now','localtime'))
);
CREATE UNIQUE INDEX uk_user_username ON sys_user(username);
CREATE UNIQUE INDEX uk_user_empno ON sys_user(employee_no);

CREATE TABLE sys_team (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    name            TEXT NOT NULL,
    description     TEXT,
    created_at      TEXT NOT NULL DEFAULT (datetime('now','localtime')),
    updated_at      TEXT NOT NULL DEFAULT (datetime('now','localtime'))
);
CREATE UNIQUE INDEX uk_team_name ON sys_team(name);

CREATE TABLE cfg_product (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    name            TEXT NOT NULL,
    description     TEXT,
    active          INTEGER NOT NULL DEFAULT 1,
    created_at      TEXT NOT NULL DEFAULT (datetime('now','localtime')),
    updated_at      TEXT NOT NULL DEFAULT (datetime('now','localtime'))
);
CREATE UNIQUE INDEX uk_product_name ON cfg_product(name);

CREATE TABLE cfg_module (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    product_id      INTEGER,
    name            TEXT NOT NULL,
    description     TEXT,
    active          INTEGER NOT NULL DEFAULT 1,
    created_at      TEXT NOT NULL DEFAULT (datetime('now','localtime')),
    updated_at      TEXT NOT NULL DEFAULT (datetime('now','localtime'))
);

CREATE TABLE cfg_product_version (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    product_id      INTEGER,
    version         TEXT NOT NULL,
    description     TEXT,
    active          INTEGER NOT NULL DEFAULT 1,
    created_at      TEXT NOT NULL DEFAULT (datetime('now','localtime')),
    updated_at      TEXT NOT NULL DEFAULT (datetime('now','localtime'))
);

CREATE TABLE cfg_issue_domain (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    name            TEXT NOT NULL,
    description     TEXT,
    created_at      TEXT NOT NULL DEFAULT (datetime('now','localtime')),
    updated_at      TEXT NOT NULL DEFAULT (datetime('now','localtime'))
);
CREATE UNIQUE INDEX uk_domain_name ON cfg_issue_domain(name);

CREATE TABLE issue (
    id                  INTEGER PRIMARY KEY AUTOINCREMENT,
    code                TEXT NOT NULL,
    raised_at           TEXT NOT NULL,
    module_id           INTEGER,
    description         TEXT NOT NULL,
    search_keywords     TEXT,
    env_info            TEXT,
    vpn_info            TEXT,
    domain_id           INTEGER,
    product_id          INTEGER,
    submitter_id        INTEGER NOT NULL,
    submitter_no        TEXT,
    found_version_id    INTEGER,
    priority            TEXT NOT NULL,
    status              TEXT NOT NULL,
    assignee_id         INTEGER,
    collaborator_ids    TEXT,
    latest_progress     TEXT,
    root_cause          TEXT,
    resolution          TEXT,
    workaround          TEXT,
    plan_finish_at      TEXT,
    located_at          TEXT,
    resolved_at         TEXT,
    closed_at           TEXT,
    created_at          TEXT NOT NULL DEFAULT (datetime('now','localtime')),
    updated_at          TEXT NOT NULL DEFAULT (datetime('now','localtime'))
);
CREATE UNIQUE INDEX uk_issue_code ON issue(code);
CREATE INDEX idx_issue_status ON issue(status);
CREATE INDEX idx_issue_assignee ON issue(assignee_id);
CREATE INDEX idx_issue_submitter ON issue(submitter_id);

CREATE TABLE version_investigation (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    issue_id        INTEGER NOT NULL,
    version_id      INTEGER NOT NULL,
    investigator_id INTEGER,
    status          TEXT NOT NULL,
    result          TEXT,
    handling_note   TEXT,
    fix_version_id  INTEGER,
    verify_result   TEXT,
    completed_at    TEXT,
    created_at      TEXT NOT NULL DEFAULT (datetime('now','localtime')),
    updated_at      TEXT NOT NULL DEFAULT (datetime('now','localtime'))
);
CREATE INDEX idx_invest_issue ON version_investigation(issue_id);
CREATE INDEX idx_invest_version ON version_investigation(version_id);

CREATE TABLE issue_progress (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    issue_id    INTEGER NOT NULL,
    author_id   INTEGER NOT NULL,
    type        TEXT NOT NULL,
    content     TEXT NOT NULL,
    created_at  TEXT NOT NULL DEFAULT (datetime('now','localtime')),
    updated_at  TEXT NOT NULL DEFAULT (datetime('now','localtime'))
);
CREATE INDEX idx_progress_issue ON issue_progress(issue_id);

CREATE TABLE issue_comment (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    issue_id    INTEGER NOT NULL,
    author_id   INTEGER NOT NULL,
    content     TEXT NOT NULL,
    mention_ids TEXT,
    created_at  TEXT NOT NULL DEFAULT (datetime('now','localtime')),
    updated_at  TEXT NOT NULL DEFAULT (datetime('now','localtime'))
);
CREATE INDEX idx_comment_issue ON issue_comment(issue_id);

CREATE TABLE operation_log (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    issue_id    INTEGER NOT NULL,
    operator_id INTEGER NOT NULL,
    action      TEXT NOT NULL,
    field       TEXT,
    old_value   TEXT,
    new_value   TEXT,
    remark      TEXT,
    created_at  TEXT NOT NULL DEFAULT (datetime('now','localtime')),
    updated_at  TEXT NOT NULL DEFAULT (datetime('now','localtime'))
);
CREATE INDEX idx_oplog_issue ON operation_log(issue_id);
