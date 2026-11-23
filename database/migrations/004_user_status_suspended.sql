-- Add a SUSPENDED state to users.status so admins can block an account.
-- Non-destructive: existing PENDING_VERIFICATION / ACTIVE rows are untouched.
ALTER TABLE users
  MODIFY status ENUM('PENDING_VERIFICATION','ACTIVE','SUSPENDED') NOT NULL DEFAULT 'PENDING_VERIFICATION';
