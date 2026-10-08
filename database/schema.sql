CREATE DATABASE IF NOT EXISTS tryout_app
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE tryout_app;

CREATE TABLE IF NOT EXISTS users (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  name VARCHAR(100) NOT NULL,
  email VARCHAR(255) NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  role ENUM('USER', 'ADMIN') NOT NULL DEFAULT 'USER',
  status ENUM('PENDING_VERIFICATION', 'ACTIVE') NOT NULL DEFAULT 'PENDING_VERIFICATION',
  email_verified_at DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_users_email (email),
  KEY idx_users_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS email_verification_tokens (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id BIGINT UNSIGNED NOT NULL,
  token_hash CHAR(64) NOT NULL,
  expires_at DATETIME NOT NULL,
  used_at DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_email_verification_token_hash (token_hash),
  KEY idx_email_verification_user (user_id),
  KEY idx_email_verification_lookup (token_hash, expires_at, used_at),
  CONSTRAINT fk_email_verification_user
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS password_reset_tokens (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id BIGINT UNSIGNED NOT NULL,
  token_hash CHAR(64) NOT NULL,
  expires_at DATETIME NOT NULL,
  used_at DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_password_reset_token_hash (token_hash),
  KEY idx_password_reset_user (user_id),
  KEY idx_password_reset_lookup (token_hash, expires_at, used_at),
  CONSTRAINT fk_password_reset_user
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Assessment content schema, aligned with the current MySQL domain tables.
CREATE TABLE IF NOT EXISTS assessments (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  type ENUM('LATIHAN', 'TRYOUT') NOT NULL,
  title VARCHAR(255) NOT NULL,
  description TEXT NULL,
  access_type ENUM('FREE', 'PREMIUM') NOT NULL DEFAULT 'FREE',
  duration_minutes INT UNSIGNED NULL,
  passing_score_twk DECIMAL(10,2) NOT NULL DEFAULT 0,
  passing_score_tiu DECIMAL(10,2) NOT NULL DEFAULT 0,
  passing_score_tkp DECIMAL(10,2) NOT NULL DEFAULT 0,
  is_released BOOLEAN NOT NULL DEFAULT FALSE,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_assessments_listing (type, access_type, is_released),
  KEY idx_assessments_released (is_released),
  CONSTRAINT chk_assessments_duration CHECK (
    (type = 'LATIHAN' AND duration_minutes IS NULL) OR
    (type = 'TRYOUT' AND duration_minutes IS NOT NULL AND duration_minutes > 0)
  ),
  CONSTRAINT chk_assessments_passing_score CHECK (
    passing_score_twk >= 0 AND passing_score_tiu >= 0 AND passing_score_tkp >= 0
  )
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS question_types (
  id TINYINT UNSIGNED NOT NULL AUTO_INCREMENT,
  code ENUM('TWK', 'TIU', 'TKP') NOT NULL,
  name VARCHAR(100) NOT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uk_question_types_code (code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT IGNORE INTO question_types (id, code, name) VALUES
  (1, 'TWK', 'Tes Wawasan Kebangsaan'),
  (2, 'TIU', 'Tes Intelegensi Umum'),
  (3, 'TKP', 'Tes Karakteristik Pribadi');

CREATE TABLE IF NOT EXISTS attachments (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  file_name VARCHAR(255) NOT NULL,
  original_name VARCHAR(255) NOT NULL,
  file_path VARCHAR(500) NOT NULL,
  file_url VARCHAR(500) NULL,
  mime_type VARCHAR(100) NOT NULL,
  file_size BIGINT UNSIGNED NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_attachments_mime_type (mime_type),
  CONSTRAINT chk_attachments_file_size CHECK (file_size > 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS question_packages (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  assessment_id BIGINT UNSIGNED NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uk_question_packages_assessment (assessment_id),
  UNIQUE KEY uk_question_packages_id_assessment (id, assessment_id),
  CONSTRAINT fk_question_packages_assessment FOREIGN KEY (assessment_id) REFERENCES assessments (id) ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS questions (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  question_package_id BIGINT UNSIGNED NOT NULL,
  question_type_id TINYINT UNSIGNED NOT NULL,
  question_number SMALLINT UNSIGNED NOT NULL,
  question_text TEXT NOT NULL,
  explanation TEXT NULL,
  image_attachment_id BIGINT UNSIGNED NULL,
  explanation_attachment_id BIGINT UNSIGNED NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uk_questions_package_number (question_package_id, question_number),
  KEY idx_questions_package (question_package_id),
  KEY idx_questions_type (question_type_id),
  KEY idx_questions_image (image_attachment_id),
  KEY idx_questions_explanation_attachment (explanation_attachment_id),
  CONSTRAINT fk_questions_explanation_attachment FOREIGN KEY (explanation_attachment_id) REFERENCES attachments (id) ON UPDATE CASCADE,
  CONSTRAINT fk_questions_image FOREIGN KEY (image_attachment_id) REFERENCES attachments (id) ON UPDATE CASCADE,
  CONSTRAINT fk_questions_package FOREIGN KEY (question_package_id) REFERENCES question_packages (id) ON UPDATE CASCADE,
  CONSTRAINT fk_questions_type FOREIGN KEY (question_type_id) REFERENCES question_types (id) ON UPDATE CASCADE,
  CONSTRAINT chk_questions_number CHECK (question_number > 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS answer_options (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  question_id BIGINT UNSIGNED NOT NULL,
  option_code ENUM('A', 'B', 'C', 'D') NOT NULL,
  option_text TEXT NOT NULL,
  option_order TINYINT UNSIGNED NOT NULL,
  score DECIMAL(10,2) NOT NULL DEFAULT 0,
  image_attachment_id BIGINT UNSIGNED NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uk_answer_options_question_code (question_id, option_code),
  UNIQUE KEY uk_answer_options_question_order (question_id, option_order),
  UNIQUE KEY uk_answer_options_id_question (id, question_id),
  KEY idx_answer_options_question (question_id),
  KEY idx_answer_options_image (image_attachment_id),
  CONSTRAINT fk_answer_options_image FOREIGN KEY (image_attachment_id) REFERENCES attachments (id) ON UPDATE CASCADE,
  CONSTRAINT fk_answer_options_question FOREIGN KEY (question_id) REFERENCES questions (id) ON UPDATE CASCADE,
  CONSTRAINT chk_answer_options_order CHECK (option_order BETWEEN 1 AND 4),
  CONSTRAINT chk_answer_options_score CHECK (score >= 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
