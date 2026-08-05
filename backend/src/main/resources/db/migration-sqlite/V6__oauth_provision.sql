-- OAuth 对接：sys_user.password 允许为空（统一认证建档用户无本地密码）
-- SQLite 通过重建表实现列约束变更
CREATE TABLE sys_user_new (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    employee_no  TEXT NOT NULL,
    username     TEXT NOT NULL,
    display_name TEXT NOT NULL,
    password     TEXT,
    role         TEXT NOT NULL,
    email        TEXT,
    phone        TEXT,
    team_id      INTEGER,
    avatar_color TEXT,
    active       INTEGER NOT NULL DEFAULT 1,
    created_at   TEXT NOT NULL DEFAULT (datetime('now','localtime')),
    updated_at   TEXT NOT NULL DEFAULT (datetime('now','localtime'))
);

INSERT INTO sys_user_new (
    id, employee_no, username, display_name, password, role, email, phone,
    team_id, avatar_color, active, created_at, updated_at
)
SELECT
    id, employee_no, username, display_name, password, role, email, phone,
    team_id, avatar_color, active, created_at, updated_at
FROM sys_user;

DROP TABLE sys_user;
ALTER TABLE sys_user_new RENAME TO sys_user;

CREATE UNIQUE INDEX uk_user_username ON sys_user(username);
CREATE UNIQUE INDEX uk_user_empno ON sys_user(employee_no);
