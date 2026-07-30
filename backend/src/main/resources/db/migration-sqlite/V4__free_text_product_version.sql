ALTER TABLE issue ADD COLUMN product_name TEXT;
ALTER TABLE issue ADD COLUMN found_version_name TEXT;

UPDATE issue
SET product_name = (
    SELECT name FROM cfg_product WHERE cfg_product.id = issue.product_id
)
WHERE product_name IS NULL AND product_id IS NOT NULL;

UPDATE issue
SET found_version_name = (
    SELECT version FROM cfg_product_version WHERE cfg_product_version.id = issue.found_version_id
)
WHERE found_version_name IS NULL AND found_version_id IS NOT NULL;

CREATE INDEX idx_issue_product_name ON issue(product_name);
CREATE INDEX idx_issue_found_version_name ON issue(found_version_name);

ALTER TABLE version_investigation ADD COLUMN version_name TEXT;
ALTER TABLE version_investigation ADD COLUMN fix_version_name TEXT;

UPDATE version_investigation
SET version_name = (
    SELECT version FROM cfg_product_version
    WHERE cfg_product_version.id = version_investigation.version_id
)
WHERE version_name IS NULL AND version_id IS NOT NULL;

UPDATE version_investigation
SET fix_version_name = (
    SELECT version FROM cfg_product_version
    WHERE cfg_product_version.id = version_investigation.fix_version_id
)
WHERE fix_version_name IS NULL AND fix_version_id IS NOT NULL;

CREATE INDEX idx_invest_version_name ON version_investigation(version_name);
