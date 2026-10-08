-- One-time, non-destructive alignment for the existing assessment type enum.
-- Existing EXERCISE rows become LATIHAN; the existing duration rule is preserved.
ALTER TABLE assessments
  DROP CONSTRAINT chk_assessments_duration;

ALTER TABLE assessments
  MODIFY COLUMN type ENUM('EXERCISE', 'LATIHAN', 'TRYOUT') NOT NULL;

UPDATE assessments
SET type = 'LATIHAN'
WHERE type = 'EXERCISE';

ALTER TABLE assessments
  MODIFY COLUMN type ENUM('LATIHAN', 'TRYOUT') NOT NULL;

ALTER TABLE assessments
  ADD CONSTRAINT chk_assessments_duration CHECK (
    (type = 'LATIHAN' AND duration_minutes IS NULL) OR
    (type = 'TRYOUT' AND duration_minutes IS NOT NULL AND duration_minutes > 0)
  );
