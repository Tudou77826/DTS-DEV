ALTER TABLE issue
    ADD COLUMN product_name VARCHAR(255) NULL AFTER product_id,
    ADD COLUMN found_version_name VARCHAR(255) NULL AFTER found_version_id;

UPDATE issue i
LEFT JOIN cfg_product p ON p.id = i.product_id
SET i.product_name = p.name
WHERE i.product_name IS NULL AND i.product_id IS NOT NULL;

UPDATE issue i
LEFT JOIN cfg_product_version v ON v.id = i.found_version_id
SET i.found_version_name = v.version
WHERE i.found_version_name IS NULL AND i.found_version_id IS NOT NULL;

CREATE INDEX idx_issue_product_name ON issue(product_name);
CREATE INDEX idx_issue_found_version_name ON issue(found_version_name);

ALTER TABLE version_investigation
    ADD COLUMN version_name VARCHAR(255) NULL AFTER version_id,
    ADD COLUMN fix_version_name VARCHAR(255) NULL AFTER fix_version_id;

UPDATE version_investigation vi
LEFT JOIN cfg_product_version v ON v.id = vi.version_id
SET vi.version_name = v.version
WHERE vi.version_name IS NULL AND vi.version_id IS NOT NULL;

UPDATE version_investigation vi
LEFT JOIN cfg_product_version v ON v.id = vi.fix_version_id
SET vi.fix_version_name = v.version
WHERE vi.fix_version_name IS NULL AND vi.fix_version_id IS NOT NULL;

CREATE INDEX idx_invest_version_name ON version_investigation(version_name);
