ALTER TABLE issue ADD COLUMN title TEXT NOT NULL DEFAULT '';

UPDATE issue
SET title = code
WHERE title = '';

CREATE INDEX idx_issue_title ON issue (title);
