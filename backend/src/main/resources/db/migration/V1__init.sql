-- ============================================================
-- 问题管理平台 建表脚本（MySQL）
-- ============================================================

-- 用户表
CREATE TABLE sys_user (
    id              BIGINT       NOT NULL AUTO_INCREMENT,
    employee_no     VARCHAR(32)  NOT NULL,
    username        VARCHAR(64)  NOT NULL,
    display_name    VARCHAR(64)  NOT NULL,
    password        VARCHAR(255) NOT NULL,
    role            VARCHAR(32)  NOT NULL,
    email           VARCHAR(64)  DEFAULT NULL,
    phone           VARCHAR(32)  DEFAULT NULL,
    team_id         BIGINT       DEFAULT NULL,
    avatar_color    VARCHAR(16)  DEFAULT NULL,
    active          TINYINT(1)   NOT NULL DEFAULT 1,
    created_at      DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at      DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uk_user_username (username),
    UNIQUE KEY uk_user_empno (employee_no)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 团队表
CREATE TABLE sys_team (
    id              BIGINT       NOT NULL AUTO_INCREMENT,
    name            VARCHAR(64)  NOT NULL,
    description     VARCHAR(255) DEFAULT NULL,
    created_at      DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at      DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uk_team_name (name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 产品表
CREATE TABLE cfg_product (
    id              BIGINT       NOT NULL AUTO_INCREMENT,
    name            VARCHAR(64)  NOT NULL,
    description     VARCHAR(255) DEFAULT NULL,
    active          TINYINT(1)   NOT NULL DEFAULT 1,
    created_at      DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at      DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uk_product_name (name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 模块表
CREATE TABLE cfg_module (
    id              BIGINT       NOT NULL AUTO_INCREMENT,
    product_id      BIGINT       DEFAULT NULL,
    name            VARCHAR(64)  NOT NULL,
    description     VARCHAR(255) DEFAULT NULL,
    active          TINYINT(1)   NOT NULL DEFAULT 1,
    created_at      DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at      DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 产品版本表
CREATE TABLE cfg_product_version (
    id              BIGINT       NOT NULL AUTO_INCREMENT,
    product_id      BIGINT       DEFAULT NULL,
    version         VARCHAR(64)  NOT NULL,
    description     VARCHAR(255) DEFAULT NULL,
    active          TINYINT(1)   NOT NULL DEFAULT 1,
    created_at      DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at      DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 问题领域表
CREATE TABLE cfg_issue_domain (
    id              BIGINT       NOT NULL AUTO_INCREMENT,
    name            VARCHAR(64)  NOT NULL,
    description     VARCHAR(255) DEFAULT NULL,
    created_at      DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at      DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uk_domain_name (name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 问题表
CREATE TABLE issue (
    id                  BIGINT       NOT NULL AUTO_INCREMENT,
    code                VARCHAR(32)  NOT NULL,
    raised_at           DATETIME     NOT NULL,
    module_id           BIGINT       DEFAULT NULL,
    description         TEXT         NOT NULL,
    search_keywords     TEXT         DEFAULT NULL,
    env_info            TEXT         DEFAULT NULL,
    vpn_info            VARCHAR(255) DEFAULT NULL,
    domain_id           BIGINT       DEFAULT NULL,
    product_id          BIGINT       DEFAULT NULL,
    submitter_id        BIGINT       NOT NULL,
    submitter_no        VARCHAR(32)  DEFAULT NULL,
    found_version_id    BIGINT       DEFAULT NULL,
    priority            VARCHAR(16)  NOT NULL,
    status              VARCHAR(32)  NOT NULL,
    assignee_id         BIGINT       DEFAULT NULL,
    collaborator_ids    VARCHAR(255) DEFAULT NULL,
    latest_progress     TEXT         DEFAULT NULL,
    root_cause          TEXT         DEFAULT NULL,
    resolution          TEXT         DEFAULT NULL,
    workaround          TEXT         DEFAULT NULL,
    plan_finish_at      DATETIME     DEFAULT NULL,
    located_at          DATETIME     DEFAULT NULL,
    resolved_at         DATETIME     DEFAULT NULL,
    closed_at           DATETIME     DEFAULT NULL,
    created_at          DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at          DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uk_issue_code (code),
    KEY idx_issue_status (status),
    KEY idx_issue_assignee (assignee_id),
    KEY idx_issue_submitter (submitter_id),
    KEY idx_issue_created (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 版本排查记录表
CREATE TABLE version_investigation (
    id              BIGINT   NOT NULL AUTO_INCREMENT,
    issue_id        BIGINT   NOT NULL,
    version_id      BIGINT   NOT NULL,
    investigator_id BIGINT   DEFAULT NULL,
    status          VARCHAR(32) NOT NULL,
    result          TEXT     DEFAULT NULL,
    handling_note   TEXT     DEFAULT NULL,
    fix_version_id  BIGINT   DEFAULT NULL,
    verify_result   TEXT     DEFAULT NULL,
    completed_at    DATETIME DEFAULT NULL,
    created_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    KEY idx_invest_issue (issue_id),
    KEY idx_invest_version (version_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 进展记录表
CREATE TABLE issue_progress (
    id          BIGINT      NOT NULL AUTO_INCREMENT,
    issue_id    BIGINT      NOT NULL,
    author_id   BIGINT      NOT NULL,
    type        VARCHAR(32) NOT NULL,
    content     TEXT        NOT NULL,
    created_at  DATETIME    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at  DATETIME    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    KEY idx_progress_issue (issue_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 评论表
CREATE TABLE issue_comment (
    id          BIGINT      NOT NULL AUTO_INCREMENT,
    issue_id    BIGINT      NOT NULL,
    author_id   BIGINT      NOT NULL,
    content     TEXT        NOT NULL,
    mention_ids VARCHAR(255) DEFAULT NULL,
    created_at  DATETIME    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at  DATETIME    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    KEY idx_comment_issue (issue_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 操作日志表
CREATE TABLE operation_log (
    id          BIGINT      NOT NULL AUTO_INCREMENT,
    issue_id    BIGINT      NOT NULL,
    operator_id BIGINT      NOT NULL,
    action      VARCHAR(32) NOT NULL,
    field       VARCHAR(64) DEFAULT NULL,
    old_value   TEXT        DEFAULT NULL,
    new_value   TEXT        DEFAULT NULL,
    remark      TEXT        DEFAULT NULL,
    created_at  DATETIME    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at  DATETIME    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    KEY idx_oplog_issue (issue_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
