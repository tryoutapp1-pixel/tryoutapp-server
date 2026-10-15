-- Align existing subscription rows with the FREE/PREMIUM product model.
-- Add the target values before converting rows so strict SQL mode never coerces enum values.
ALTER TABLE subscriptions
  MODIFY status ENUM('ACTIVE','EXPIRED','CANCELLED','FREE','PREMIUM') NOT NULL DEFAULT 'FREE',
  MODIFY started_at DATETIME NULL,
  MODIFY expired_at DATETIME NULL,
  DROP INDEX uk_subscriptions_active_user,
  MODIFY active_user_id BIGINT(20) UNSIGNED
    GENERATED ALWAYS AS (CASE WHEN status IN ('ACTIVE','PREMIUM') THEN user_id ELSE NULL END) STORED;

-- Existing ACTIVE rows still in date are preserved as PREMIUM; other legacy states become FREE.
UPDATE subscriptions
SET status = CASE WHEN status = 'ACTIVE' AND expired_at > NOW() THEN 'PREMIUM' ELSE 'FREE' END;

ALTER TABLE subscriptions
  MODIFY status ENUM('FREE','PREMIUM') NOT NULL DEFAULT 'FREE',
  MODIFY active_user_id BIGINT(20) UNSIGNED
    GENERATED ALWAYS AS (CASE WHEN status = 'PREMIUM' THEN user_id ELSE NULL END) STORED;
ALTER TABLE subscriptions ADD UNIQUE KEY uk_subscriptions_active_user (active_user_id);

-- New users must have exactly one subscription row; check for duplicates before applying.
INSERT INTO subscriptions (user_id, status, started_at, expired_at)
SELECT u.id, 'FREE', NULL, NULL
FROM users u
LEFT JOIN subscriptions s ON s.user_id = u.id
WHERE s.id IS NULL;

ALTER TABLE subscriptions ADD UNIQUE KEY uk_subscriptions_user_id (user_id);

-- Enforce the one-feedback-per-user-and-assessment rule at the database boundary.
ALTER TABLE feedbacks ADD UNIQUE KEY uk_feedbacks_user_assessment (user_id, assessment_id);

-- Retain the frontend-safe Snap token so a still-pending local payment can be resumed.
ALTER TABLE transactions ADD COLUMN snap_token VARCHAR(255) DEFAULT NULL AFTER amount;
