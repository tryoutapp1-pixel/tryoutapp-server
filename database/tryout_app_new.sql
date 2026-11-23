-- phpMyAdmin SQL Dump
-- version 5.2.3
-- https://www.phpmyadmin.net/
--
-- Host: 127.0.0.1
-- Waktu pembuatan: 23 Nov 2026 pada 11.33
-- Versi server: 10.11.16-MariaDB
-- Versi PHP: 8.5.12

SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO";
START TRANSACTION;
SET time_zone = "+00:00";


/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!40101 SET NAMES utf8mb4 */;

--
-- Basis data: `tryout_app`
--

-- --------------------------------------------------------

--
-- Struktur dari tabel `answer_options`
--

CREATE TABLE `answer_options` (
  `id` bigint(20) UNSIGNED NOT NULL,
  `question_id` bigint(20) UNSIGNED NOT NULL,
  `option_code` enum('A','B','C','D','E') NOT NULL,
  `option_text` text NOT NULL,
  `option_order` tinyint(3) UNSIGNED NOT NULL,
  `score` decimal(10,2) NOT NULL DEFAULT 0.00,
  `image_attachment_id` bigint(20) UNSIGNED DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Struktur dari tabel `assessments`
--

CREATE TABLE `assessments` (
  `id` bigint(20) UNSIGNED NOT NULL,
  `type` enum('LATIHAN','TRYOUT') NOT NULL,
  `title` varchar(255) NOT NULL,
  `description` text DEFAULT NULL,
  `access_type` enum('FREE','PREMIUM') NOT NULL DEFAULT 'FREE',
  `duration_minutes` int(10) UNSIGNED DEFAULT NULL,
  `passing_score_twk` decimal(10,2) NOT NULL DEFAULT 0.00,
  `passing_score_tiu` decimal(10,2) NOT NULL DEFAULT 0.00,
  `passing_score_tkp` decimal(10,2) NOT NULL DEFAULT 0.00,
  `is_released` tinyint(1) NOT NULL DEFAULT 0,
  `created_at` datetime NOT NULL DEFAULT current_timestamp(),
  `updated_at` datetime NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Trigger `assessments`
--
DELIMITER $$
CREATE TRIGGER `trg_assessments_before_update_immutable` BEFORE UPDATE ON `assessments` FOR EACH ROW BEGIN

    IF EXISTS (
        SELECT 1
        FROM question_packages qp
        WHERE qp.assessment_id = OLD.id
    )
    THEN

        IF NOT (
            NEW.type <=> OLD.type
            AND NEW.title <=> OLD.title
            AND NEW.description <=> OLD.description
            AND NEW.access_type <=> OLD.access_type
            AND NEW.duration_minutes <=> OLD.duration_minutes
            AND NEW.passing_score_twk <=> OLD.passing_score_twk
            AND NEW.passing_score_tiu <=> OLD.passing_score_tiu
            AND NEW.passing_score_tkp <=> OLD.passing_score_tkp
        )
        THEN

            SIGNAL SQLSTATE '45000'
                SET MESSAGE_TEXT =
                    'Assessment yang sudah memiliki package tidak dapat mengubah metadata. Buat assessment baru.';

        END IF;

    END IF;

END
$$
DELIMITER ;
DELIMITER $$
CREATE TRIGGER `trg_assessments_before_update_release` BEFORE UPDATE ON `assessments` FOR EACH ROW BEGIN

    IF NEW.is_released = TRUE
       AND OLD.is_released = FALSE
    THEN

        IF NOT EXISTS (
            SELECT 1
            FROM question_packages qp
            WHERE qp.assessment_id = NEW.id
        )
        THEN
            SIGNAL SQLSTATE '45000'
                SET MESSAGE_TEXT =
                    'Assessment tidak dapat direlease karena belum memiliki question package';
        END IF;

    END IF;

END
$$
DELIMITER ;

-- --------------------------------------------------------

--
-- Struktur dari tabel `attachments`
--

CREATE TABLE `attachments` (
  `id` bigint(20) UNSIGNED NOT NULL,
  `file_name` varchar(255) NOT NULL,
  `original_name` varchar(255) NOT NULL,
  `file_path` varchar(500) NOT NULL,
  `object_key` varchar(500) DEFAULT NULL,
  `file_url` varchar(500) DEFAULT NULL,
  `mime_type` varchar(100) NOT NULL,
  `file_size` bigint(20) UNSIGNED NOT NULL,
  `created_at` datetime NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Struktur dari tabel `attempts`
--

CREATE TABLE `attempts` (
  `id` bigint(20) UNSIGNED NOT NULL,
  `user_id` bigint(20) UNSIGNED NOT NULL,
  `assessment_id` bigint(20) UNSIGNED NOT NULL,
  `question_package_id` bigint(20) UNSIGNED NOT NULL,
  `started_at` datetime NOT NULL,
  `expired_at` datetime DEFAULT NULL,
  `ended_at` datetime DEFAULT NULL,
  `status` enum('IN_PROGRESS','COMPLETED','EXPIRED','ABANDONED') NOT NULL DEFAULT 'IN_PROGRESS',
  `created_at` datetime NOT NULL DEFAULT current_timestamp(),
  `updated_at` datetime NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Struktur dari tabel `attempt_answers`
--

CREATE TABLE `attempt_answers` (
  `id` bigint(20) UNSIGNED NOT NULL,
  `attempt_id` bigint(20) UNSIGNED NOT NULL,
  `question_id` bigint(20) UNSIGNED NOT NULL,
  `selected_option_id` bigint(20) UNSIGNED DEFAULT NULL,
  `answered_at` datetime DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT current_timestamp(),
  `updated_at` datetime NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Struktur dari tabel `attempt_results`
--

CREATE TABLE `attempt_results` (
  `id` bigint(20) UNSIGNED NOT NULL,
  `attempt_id` bigint(20) UNSIGNED NOT NULL,
  `total_score` decimal(10,2) NOT NULL DEFAULT 0.00,
  `twk_score` decimal(10,2) NOT NULL DEFAULT 0.00,
  `tiu_score` decimal(10,2) NOT NULL DEFAULT 0.00,
  `tkp_score` decimal(10,2) NOT NULL DEFAULT 0.00,
  `twk_passed` tinyint(1) NOT NULL DEFAULT 0,
  `tiu_passed` tinyint(1) NOT NULL DEFAULT 0,
  `tkp_passed` tinyint(1) NOT NULL DEFAULT 0,
  `total_correct` int(10) UNSIGNED NOT NULL DEFAULT 0,
  `total_wrong` int(10) UNSIGNED NOT NULL DEFAULT 0,
  `total_unanswered` int(10) UNSIGNED NOT NULL DEFAULT 0,
  `calculated_at` datetime NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Struktur dari tabel `email_verification_tokens`
--

CREATE TABLE `email_verification_tokens` (
  `id` bigint(20) UNSIGNED NOT NULL,
  `user_id` bigint(20) UNSIGNED NOT NULL,
  `token_hash` varchar(255) NOT NULL,
  `expires_at` datetime NOT NULL,
  `used_at` datetime DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Struktur dari tabel `feedbacks`
--

CREATE TABLE `feedbacks` (
  `id` bigint(20) UNSIGNED NOT NULL,
  `user_id` bigint(20) UNSIGNED NOT NULL,
  `assessment_id` bigint(20) UNSIGNED NOT NULL,
  `rating` tinyint(3) UNSIGNED NOT NULL,
  `difficulty` enum('EASY','MEDIUM','HARD') NOT NULL,
  `comment` text DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT current_timestamp(),
  `updated_at` datetime NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Struktur dari tabel `materials`
--

CREATE TABLE `materials` (
  `id` bigint(20) UNSIGNED NOT NULL,
  `title` varchar(255) NOT NULL,
  `description` text DEFAULT NULL,
  `type` enum('TWK','TIU','TKP') NOT NULL,
  `access_type` enum('FREE','PREMIUM') NOT NULL DEFAULT 'FREE',
  `attachment_id` bigint(20) UNSIGNED NOT NULL,
  `is_released` tinyint(1) NOT NULL DEFAULT 0,
  `created_at` datetime NOT NULL DEFAULT current_timestamp(),
  `updated_at` datetime NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Struktur dari tabel `password_reset_tokens`
--

CREATE TABLE `password_reset_tokens` (
  `id` bigint(20) UNSIGNED NOT NULL,
  `user_id` bigint(20) UNSIGNED NOT NULL,
  `token_hash` varchar(255) NOT NULL,
  `expires_at` datetime NOT NULL,
  `used_at` datetime DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Struktur dari tabel `questions`
--

CREATE TABLE `questions` (
  `id` bigint(20) UNSIGNED NOT NULL,
  `question_package_id` bigint(20) UNSIGNED NOT NULL,
  `question_type_id` tinyint(3) UNSIGNED NOT NULL,
  `question_number` smallint(5) UNSIGNED NOT NULL,
  `question_text` text NOT NULL,
  `explanation` text DEFAULT NULL,
  `image_attachment_id` bigint(20) UNSIGNED DEFAULT NULL,
  `explanation_attachment_id` bigint(20) UNSIGNED DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Struktur dari tabel `question_packages`
--

CREATE TABLE `question_packages` (
  `id` bigint(20) UNSIGNED NOT NULL,
  `assessment_id` bigint(20) UNSIGNED NOT NULL,
  `created_at` datetime NOT NULL DEFAULT current_timestamp(),
  `updated_at` datetime NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Struktur dari tabel `question_types`
--

CREATE TABLE `question_types` (
  `id` tinyint(3) UNSIGNED NOT NULL,
  `code` enum('TWK','TIU','TKP') NOT NULL,
  `name` varchar(100) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Struktur dari tabel `subscriptions`
--

CREATE TABLE `subscriptions` (
  `id` bigint(20) UNSIGNED NOT NULL,
  `user_id` bigint(20) UNSIGNED NOT NULL,
  `status` enum('FREE','PREMIUM') NOT NULL DEFAULT 'FREE',
  `started_at` datetime DEFAULT NULL,
  `expired_at` datetime DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT current_timestamp(),
  `updated_at` datetime NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  `active_user_id` bigint(20) UNSIGNED GENERATED ALWAYS AS (case when `status` = 'PREMIUM' then `user_id` else NULL end) STORED
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Struktur dari tabel `transactions`
--

CREATE TABLE `transactions` (
  `id` bigint(20) UNSIGNED NOT NULL,
  `user_id` bigint(20) UNSIGNED NOT NULL,
  `order_id` varchar(100) NOT NULL,
  `amount` decimal(15,2) NOT NULL,
  `snap_token` varchar(255) DEFAULT NULL,
  `status` enum('PENDING','PAID','FAILED','EXPIRED','CANCELLED') NOT NULL DEFAULT 'PENDING',
  `payment_method` varchar(50) DEFAULT NULL,
  `midtrans_transaction_id` varchar(100) DEFAULT NULL,
  `midtrans_transaction_status` varchar(50) DEFAULT NULL,
  `paid_at` datetime DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT current_timestamp(),
  `updated_at` datetime NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Struktur dari tabel `users`
--

CREATE TABLE `users` (
  `id` bigint(20) UNSIGNED NOT NULL,
  `name` varchar(100) NOT NULL,
  `email` varchar(191) NOT NULL,
  `password_hash` varchar(255) NOT NULL,
  `role` enum('USER','ADMIN') NOT NULL DEFAULT 'USER',
  `status` enum('PENDING_VERIFICATION','ACTIVE','SUSPENDED') NOT NULL DEFAULT 'PENDING_VERIFICATION',
  `email_verified_at` datetime DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT current_timestamp(),
  `updated_at` datetime NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Indeks untuk tabel yang dibuang
--

--
-- Indeks untuk tabel `answer_options`
--
ALTER TABLE `answer_options`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `uk_answer_options_question_code` (`question_id`,`option_code`),
  ADD UNIQUE KEY `uk_answer_options_question_order` (`question_id`,`option_order`),
  ADD UNIQUE KEY `uk_answer_options_id_question` (`id`,`question_id`),
  ADD KEY `idx_answer_options_question` (`question_id`),
  ADD KEY `idx_answer_options_image` (`image_attachment_id`);

--
-- Indeks untuk tabel `assessments`
--
ALTER TABLE `assessments`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_assessments_listing` (`type`,`access_type`,`is_released`),
  ADD KEY `idx_assessments_released` (`is_released`);

--
-- Indeks untuk tabel `attachments`
--
ALTER TABLE `attachments`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_attachments_mime_type` (`mime_type`);

--
-- Indeks untuk tabel `attempts`
--
ALTER TABLE `attempts`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_attempts_user` (`user_id`),
  ADD KEY `idx_attempts_assessment` (`assessment_id`),
  ADD KEY `idx_attempts_package` (`question_package_id`),
  ADD KEY `idx_attempts_user_assessment` (`user_id`,`assessment_id`),
  ADD KEY `idx_attempts_status` (`status`),
  ADD KEY `fk_attempts_package_assessment` (`question_package_id`,`assessment_id`);

--
-- Indeks untuk tabel `attempt_answers`
--
ALTER TABLE `attempt_answers`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `uk_attempt_answers_attempt_question` (`attempt_id`,`question_id`),
  ADD KEY `idx_attempt_answers_question` (`question_id`),
  ADD KEY `idx_attempt_answers_selected_option` (`selected_option_id`),
  ADD KEY `fk_attempt_answers_option_question` (`selected_option_id`,`question_id`);

--
-- Indeks untuk tabel `attempt_results`
--
ALTER TABLE `attempt_results`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `uk_attempt_results_attempt` (`attempt_id`),
  ADD KEY `idx_attempt_results_total_score` (`total_score`),
  ADD KEY `idx_attempt_results_twk_score` (`twk_score`),
  ADD KEY `idx_attempt_results_tiu_score` (`tiu_score`),
  ADD KEY `idx_attempt_results_tkp_score` (`tkp_score`);

--
-- Indeks untuk tabel `email_verification_tokens`
--
ALTER TABLE `email_verification_tokens`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `uq_email_verification_tokens_token_hash` (`token_hash`),
  ADD KEY `idx_email_verification_tokens_user_id` (`user_id`),
  ADD KEY `idx_email_verification_tokens_expires_at` (`expires_at`);

--
-- Indeks untuk tabel `feedbacks`
--
ALTER TABLE `feedbacks`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `uk_feedbacks_user_assessment` (`user_id`,`assessment_id`),
  ADD KEY `idx_feedbacks_user` (`user_id`),
  ADD KEY `idx_feedbacks_assessment` (`assessment_id`),
  ADD KEY `idx_feedbacks_rating` (`rating`);

--
-- Indeks untuk tabel `materials`
--
ALTER TABLE `materials`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_materials_access_type` (`access_type`),
  ADD KEY `fk_materials_attachment` (`attachment_id`),
  ADD KEY `idx_materials_type` (`type`);

--
-- Indeks untuk tabel `password_reset_tokens`
--
ALTER TABLE `password_reset_tokens`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `uq_password_reset_tokens_token_hash` (`token_hash`),
  ADD KEY `idx_password_reset_tokens_user_id` (`user_id`),
  ADD KEY `idx_password_reset_tokens_expires_at` (`expires_at`);

--
-- Indeks untuk tabel `questions`
--
ALTER TABLE `questions`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `uk_questions_package_number` (`question_package_id`,`question_number`),
  ADD KEY `idx_questions_package` (`question_package_id`),
  ADD KEY `idx_questions_type` (`question_type_id`),
  ADD KEY `idx_questions_image` (`image_attachment_id`),
  ADD KEY `idx_questions_explanation_attachment` (`explanation_attachment_id`);

--
-- Indeks untuk tabel `question_packages`
--
ALTER TABLE `question_packages`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `uk_question_packages_assessment` (`assessment_id`),
  ADD UNIQUE KEY `uk_question_packages_id_assessment` (`id`,`assessment_id`);

--
-- Indeks untuk tabel `question_types`
--
ALTER TABLE `question_types`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `uk_question_types_code` (`code`);

--
-- Indeks untuk tabel `subscriptions`
--
ALTER TABLE `subscriptions`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `uk_subscriptions_user_id` (`user_id`),
  ADD UNIQUE KEY `uk_subscriptions_active_user` (`active_user_id`),
  ADD KEY `idx_subscriptions_user_id` (`user_id`),
  ADD KEY `idx_subscriptions_status` (`status`),
  ADD KEY `idx_subscriptions_expired_at` (`expired_at`);

--
-- Indeks untuk tabel `transactions`
--
ALTER TABLE `transactions`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `uk_transactions_order_id` (`order_id`),
  ADD KEY `idx_transactions_user_id` (`user_id`),
  ADD KEY `idx_transactions_status` (`status`),
  ADD KEY `idx_transactions_created_at` (`created_at`),
  ADD KEY `idx_transactions_midtrans_transaction_id` (`midtrans_transaction_id`);

--
-- Indeks untuk tabel `users`
--
ALTER TABLE `users`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `uk_users_email` (`email`),
  ADD KEY `idx_users_role` (`role`);

--
-- AUTO_INCREMENT untuk tabel yang dibuang
--

--
-- AUTO_INCREMENT untuk tabel `answer_options`
--
ALTER TABLE `answer_options`
  MODIFY `id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT untuk tabel `assessments`
--
ALTER TABLE `assessments`
  MODIFY `id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT untuk tabel `attachments`
--
ALTER TABLE `attachments`
  MODIFY `id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT untuk tabel `attempts`
--
ALTER TABLE `attempts`
  MODIFY `id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT untuk tabel `attempt_answers`
--
ALTER TABLE `attempt_answers`
  MODIFY `id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT untuk tabel `attempt_results`
--
ALTER TABLE `attempt_results`
  MODIFY `id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT untuk tabel `email_verification_tokens`
--
ALTER TABLE `email_verification_tokens`
  MODIFY `id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT untuk tabel `feedbacks`
--
ALTER TABLE `feedbacks`
  MODIFY `id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT untuk tabel `materials`
--
ALTER TABLE `materials`
  MODIFY `id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT untuk tabel `password_reset_tokens`
--
ALTER TABLE `password_reset_tokens`
  MODIFY `id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT untuk tabel `questions`
--
ALTER TABLE `questions`
  MODIFY `id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT untuk tabel `question_packages`
--
ALTER TABLE `question_packages`
  MODIFY `id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT untuk tabel `question_types`
--
ALTER TABLE `question_types`
  MODIFY `id` tinyint(3) UNSIGNED NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT untuk tabel `subscriptions`
--
ALTER TABLE `subscriptions`
  MODIFY `id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT untuk tabel `transactions`
--
ALTER TABLE `transactions`
  MODIFY `id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT untuk tabel `users`
--
ALTER TABLE `users`
  MODIFY `id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT;

--
-- Ketidakleluasaan untuk tabel pelimpahan (Dumped Tables)
--

--
-- Ketidakleluasaan untuk tabel `answer_options`
--
ALTER TABLE `answer_options`
  ADD CONSTRAINT `fk_answer_options_image` FOREIGN KEY (`image_attachment_id`) REFERENCES `attachments` (`id`) ON UPDATE CASCADE,
  ADD CONSTRAINT `fk_answer_options_question` FOREIGN KEY (`question_id`) REFERENCES `questions` (`id`) ON UPDATE CASCADE;

--
-- Ketidakleluasaan untuk tabel `attempts`
--
ALTER TABLE `attempts`
  ADD CONSTRAINT `fk_attempts_package_assessment` FOREIGN KEY (`question_package_id`,`assessment_id`) REFERENCES `question_packages` (`id`, `assessment_id`) ON UPDATE CASCADE,
  ADD CONSTRAINT `fk_attempts_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON UPDATE CASCADE;

--
-- Ketidakleluasaan untuk tabel `attempt_answers`
--
ALTER TABLE `attempt_answers`
  ADD CONSTRAINT `fk_attempt_answers_attempt` FOREIGN KEY (`attempt_id`) REFERENCES `attempts` (`id`) ON UPDATE CASCADE,
  ADD CONSTRAINT `fk_attempt_answers_option_question` FOREIGN KEY (`selected_option_id`,`question_id`) REFERENCES `answer_options` (`id`, `question_id`) ON UPDATE CASCADE,
  ADD CONSTRAINT `fk_attempt_answers_question` FOREIGN KEY (`question_id`) REFERENCES `questions` (`id`) ON UPDATE CASCADE;

--
-- Ketidakleluasaan untuk tabel `attempt_results`
--
ALTER TABLE `attempt_results`
  ADD CONSTRAINT `fk_attempt_results_attempt` FOREIGN KEY (`attempt_id`) REFERENCES `attempts` (`id`) ON UPDATE CASCADE;

--
-- Ketidakleluasaan untuk tabel `email_verification_tokens`
--
ALTER TABLE `email_verification_tokens`
  ADD CONSTRAINT `fk_email_verification_tokens_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE;

--
-- Ketidakleluasaan untuk tabel `feedbacks`
--
ALTER TABLE `feedbacks`
  ADD CONSTRAINT `fk_feedbacks_assessment` FOREIGN KEY (`assessment_id`) REFERENCES `assessments` (`id`) ON UPDATE CASCADE,
  ADD CONSTRAINT `fk_feedbacks_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON UPDATE CASCADE;

--
-- Ketidakleluasaan untuk tabel `materials`
--
ALTER TABLE `materials`
  ADD CONSTRAINT `fk_materials_attachment` FOREIGN KEY (`attachment_id`) REFERENCES `attachments` (`id`) ON UPDATE CASCADE;

--
-- Ketidakleluasaan untuk tabel `password_reset_tokens`
--
ALTER TABLE `password_reset_tokens`
  ADD CONSTRAINT `fk_password_reset_tokens_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE;

--
-- Ketidakleluasaan untuk tabel `questions`
--
ALTER TABLE `questions`
  ADD CONSTRAINT `fk_questions_explanation_attachment` FOREIGN KEY (`explanation_attachment_id`) REFERENCES `attachments` (`id`) ON UPDATE CASCADE,
  ADD CONSTRAINT `fk_questions_image` FOREIGN KEY (`image_attachment_id`) REFERENCES `attachments` (`id`) ON UPDATE CASCADE,
  ADD CONSTRAINT `fk_questions_package` FOREIGN KEY (`question_package_id`) REFERENCES `question_packages` (`id`) ON UPDATE CASCADE,
  ADD CONSTRAINT `fk_questions_type` FOREIGN KEY (`question_type_id`) REFERENCES `question_types` (`id`) ON UPDATE CASCADE;

--
-- Ketidakleluasaan untuk tabel `question_packages`
--
ALTER TABLE `question_packages`
  ADD CONSTRAINT `fk_question_packages_assessment` FOREIGN KEY (`assessment_id`) REFERENCES `assessments` (`id`) ON UPDATE CASCADE;
COMMIT;

/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
