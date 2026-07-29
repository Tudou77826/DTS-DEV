CREATE TABLE issue_attachment (
    id            BIGINT       NOT NULL AUTO_INCREMENT,
    issue_id      BIGINT       NOT NULL,
    uploader_id   BIGINT       NOT NULL,
    source_type   VARCHAR(16)  NOT NULL,
    source_id     BIGINT       DEFAULT NULL,
    original_name VARCHAR(255) NOT NULL,
    stored_name   VARCHAR(255) NOT NULL,
    content_type  VARCHAR(128) DEFAULT NULL,
    file_size     BIGINT       NOT NULL,
    storage_path  VARCHAR(512) NOT NULL,
    created_at    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    KEY idx_attachment_issue (issue_id),
    KEY idx_attachment_source (source_type, source_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE notification (
    id         BIGINT       NOT NULL AUTO_INCREMENT,
    user_id    BIGINT       NOT NULL,
    type       VARCHAR(32)  NOT NULL,
    title      VARCHAR(255) NOT NULL,
    content    TEXT         DEFAULT NULL,
    link       VARCHAR(512) DEFAULT NULL,
    read_at    DATETIME     DEFAULT NULL,
    created_at DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    KEY idx_notification_user_read (user_id, read_at),
    KEY idx_notification_created (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE issue_relation (
    id              BIGINT      NOT NULL AUTO_INCREMENT,
    source_issue_id BIGINT      NOT NULL,
    target_issue_id BIGINT      NOT NULL,
    relation_type   VARCHAR(16) NOT NULL,
    created_by      BIGINT      NOT NULL,
    created_at      DATETIME    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at      DATETIME    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uk_issue_relation (source_issue_id, target_issue_id, relation_type),
    KEY idx_relation_target (target_issue_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
