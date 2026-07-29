ALTER TABLE issue
    ADD COLUMN title VARCHAR(255) NOT NULL DEFAULT '' AFTER module_id;

UPDATE issue
SET title = code
WHERE title = '';

CREATE INDEX idx_issue_title ON issue (title);
