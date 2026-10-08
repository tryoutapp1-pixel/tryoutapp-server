-- phpMyAdmin SQL Dump
-- version 5.2.0
-- https://www.phpmyadmin.net/
--
-- Host: 127.0.0.1
-- Generation Time: Oct 08, 2026 at 03:14 PM
-- Server version: 10.4.27-MariaDB
-- PHP Version: 8.1.12

SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO";
START TRANSACTION;
SET time_zone = "+00:00";


/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!40101 SET NAMES utf8mb4 */;

--
-- Database: `tryout_app`
--

-- --------------------------------------------------------

--
-- Table structure for table `answer_options`
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
) ;

--
-- Dumping data for table `answer_options`
--

INSERT INTO `answer_options` (`id`, `question_id`, `option_code`, `option_text`, `option_order`, `score`, `image_attachment_id`, `created_at`) VALUES
(49, 13, 'A', '4 (empat)', 1, '0.00', NULL, '2026-10-01 22:10:37'),
(50, 13, 'B', 'Mengutamakan kepentingan pribadi', 2, '0.00', NULL, '2026-10-01 22:10:37'),
(51, 13, 'C', 'Acuh tak acuh', 3, '0.00', NULL, '2026-10-01 22:10:37'),
(52, 13, 'D', 'Menyeimbangkan dunia', 4, '0.00', NULL, '2026-10-01 22:10:37'),
(53, 13, 'E', 'Kembali ke masa lalu', 5, '0.00', NULL, '2026-10-01 22:10:37');

-- --------------------------------------------------------

--
-- Table structure for table `assessments`
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
) ;

--
-- Dumping data for table `assessments`
--

INSERT INTO `assessments` (`id`, `type`, `title`, `description`, `access_type`, `duration_minutes`, `passing_score_twk`, `passing_score_tiu`, `passing_score_tkp`, `is_released`, `created_at`, `updated_at`) VALUES
(1, 'TRYOUT', 'Try Out SKD 2', 'Paket latihan SKD', 'FREE', 100, '65.00', '80.00', '166.00', 0, '2026-10-01 21:28:55', '2026-10-05 19:50:09');

--
-- Triggers `assessments`
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
-- Table structure for table `attachments`
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
) ;

--
-- Dumping data for table `attachments`
--

INSERT INTO `attachments` (`id`, `file_name`, `original_name`, `file_path`, `object_key`, `file_url`, `mime_type`, `file_size`, `created_at`) VALUES
(6, '72b096f6-34ad-4487-a719-bf62949161b6.jpg', '3145081d-6a92-4c32-a8d6-065203f5097c_169.jpg', 'images/4ae81877-eb0c-41b6-b1ec-13adf6e1c55e.jpg', 'images/4ae81877-eb0c-41b6-b1ec-13adf6e1c55e.jpg', NULL, 'image/jpeg', 7265, '2026-10-06 21:53:31'),
(7, '980a123f-56a2-491f-a664-a19604c21366.jpg', 'monyet.jpg', 'images/5a6db1de-5290-4229-a61e-c19f2e5d24f8.jpg', 'images/5a6db1de-5290-4229-a61e-c19f2e5d24f8.jpg', NULL, 'image/jpeg', 29702, '2026-10-06 21:59:55');

-- --------------------------------------------------------

--
-- Table structure for table `attempts`
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
-- Table structure for table `attempt_answers`
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
-- Table structure for table `attempt_results`
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
) ;

-- --------------------------------------------------------

--
-- Table structure for table `email_verification_tokens`
--

CREATE TABLE `email_verification_tokens` (
  `id` bigint(20) UNSIGNED NOT NULL,
  `user_id` bigint(20) UNSIGNED NOT NULL,
  `token_hash` varchar(255) NOT NULL,
  `expires_at` datetime NOT NULL,
  `used_at` datetime DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT current_timestamp()
) ;

--
-- Dumping data for table `email_verification_tokens`
--

INSERT INTO `email_verification_tokens` (`id`, `user_id`, `token_hash`, `expires_at`, `used_at`, `created_at`) VALUES
(2, 2, 'b91b293e410e83a2c36a359b28136e41455bce5b123d5adb88a6326d4783d201', '2026-10-01 21:02:41', '2026-09-30 21:10:26', '2026-09-30 21:02:41'),
(3, 3, '849ffdcc85e814af204decde3a65d17716068ccbd95309fc78d0f6cf37b71e42', '2026-10-02 21:30:44', '2026-10-01 21:31:55', '2026-10-01 21:30:44');

-- --------------------------------------------------------

--
-- Table structure for table `feedbacks`
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
) ;

-- --------------------------------------------------------

--
-- Table structure for table `materials`
--

CREATE TABLE `materials` (
  `id` bigint(20) UNSIGNED NOT NULL,
  `title` varchar(255) NOT NULL,
  `description` text DEFAULT NULL,
  `access_type` enum('FREE','PREMIUM') NOT NULL DEFAULT 'FREE',
  `attachment_id` bigint(20) UNSIGNED NOT NULL,
  `is_released` tinyint(1) NOT NULL DEFAULT 0,
  `created_at` datetime NOT NULL DEFAULT current_timestamp(),
  `updated_at` datetime NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `password_reset_tokens`
--

CREATE TABLE `password_reset_tokens` (
  `id` bigint(20) UNSIGNED NOT NULL,
  `user_id` bigint(20) UNSIGNED NOT NULL,
  `token_hash` varchar(255) NOT NULL,
  `expires_at` datetime NOT NULL,
  `used_at` datetime DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `password_reset_tokens`
--

INSERT INTO `password_reset_tokens` (`id`, `user_id`, `token_hash`, `expires_at`, `used_at`, `created_at`) VALUES
(1, 2, '7504fcdb16c701f6cf8ff846164f6469fc15f17c8d9f870499602f79bdc516ce', '2026-09-30 22:36:46', '2026-09-30 21:41:25', '2026-09-30 21:36:46');

-- --------------------------------------------------------

--
-- Table structure for table `questions`
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
) ;

--
-- Dumping data for table `questions`
--

INSERT INTO `questions` (`id`, `question_package_id`, `question_type_id`, `question_number`, `question_text`, `explanation`, `image_attachment_id`, `explanation_attachment_id`, `created_at`) VALUES
(13, 13, 1, 1, 'Berapakah hasil dari 2 + 2?', 'Persatuan menjaga keutuhan bangsa.', NULL, NULL, '2026-10-01 22:10:37');

-- --------------------------------------------------------

--
-- Table structure for table `question_packages`
--

CREATE TABLE `question_packages` (
  `id` bigint(20) UNSIGNED NOT NULL,
  `assessment_id` bigint(20) UNSIGNED NOT NULL,
  `created_at` datetime NOT NULL DEFAULT current_timestamp(),
  `updated_at` datetime NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `question_packages`
--

INSERT INTO `question_packages` (`id`, `assessment_id`, `created_at`, `updated_at`) VALUES
(13, 1, '2026-10-01 22:10:37', '2026-10-01 22:10:37');

-- --------------------------------------------------------

--
-- Table structure for table `question_types`
--

CREATE TABLE `question_types` (
  `id` tinyint(3) UNSIGNED NOT NULL,
  `code` enum('TWK','TIU','TKP') NOT NULL,
  `name` varchar(100) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `question_types`
--

INSERT INTO `question_types` (`id`, `code`, `name`) VALUES
(1, 'TWK', 'Tes Wawasan Kebangsaan'),
(2, 'TIU', 'Tes Intelegensi Umum'),
(3, 'TKP', 'Tes Karakteristik Pribadi');

-- --------------------------------------------------------

--
-- Table structure for table `subscriptions`
--

CREATE TABLE `subscriptions` (
  `id` bigint(20) UNSIGNED NOT NULL,
  `user_id` bigint(20) UNSIGNED NOT NULL,
  `status` enum('ACTIVE','EXPIRED','CANCELLED') NOT NULL DEFAULT 'ACTIVE',
  `started_at` datetime NOT NULL,
  `expired_at` datetime NOT NULL,
  `created_at` datetime NOT NULL DEFAULT current_timestamp(),
  `updated_at` datetime NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  `active_user_id` bigint(20) UNSIGNED GENERATED ALWAYS AS (case when `status` = 'ACTIVE' then `user_id` else NULL end) STORED
) ;

-- --------------------------------------------------------

--
-- Table structure for table `transactions`
--

CREATE TABLE `transactions` (
  `id` bigint(20) UNSIGNED NOT NULL,
  `user_id` bigint(20) UNSIGNED NOT NULL,
  `order_id` varchar(100) NOT NULL,
  `amount` decimal(15,2) NOT NULL,
  `status` enum('PENDING','PAID','FAILED','EXPIRED','CANCELLED') NOT NULL DEFAULT 'PENDING',
  `payment_method` varchar(50) DEFAULT NULL,
  `midtrans_transaction_id` varchar(100) DEFAULT NULL,
  `midtrans_transaction_status` varchar(50) DEFAULT NULL,
  `paid_at` datetime DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT current_timestamp(),
  `updated_at` datetime NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ;

-- --------------------------------------------------------

--
-- Table structure for table `users`
--

CREATE TABLE `users` (
  `id` bigint(20) UNSIGNED NOT NULL,
  `name` varchar(100) NOT NULL,
  `email` varchar(191) NOT NULL,
  `password_hash` varchar(255) NOT NULL,
  `role` enum('USER','ADMIN') NOT NULL DEFAULT 'USER',
  `status` enum('PENDING_VERIFICATION','ACTIVE') NOT NULL DEFAULT 'PENDING_VERIFICATION',
  `email_verified_at` datetime DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT current_timestamp(),
  `updated_at` datetime NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `users`
--

INSERT INTO `users` (`id`, `name`, `email`, `password_hash`, `role`, `status`, `email_verified_at`, `created_at`, `updated_at`) VALUES
(2, 'asraf', 'asraf@gmail.com', '$2b$12$XmNDfmeNs4YW7UeH57q08uxQG3XxBlRpXGd3rBOtfNXmZtr.PMio6', 'ADMIN', 'ACTIVE', '2026-09-30 21:10:26', '2026-09-30 21:02:41', '2026-10-01 21:26:22'),
(3, 'budi', 'budi@gmail.com', '$2b$12$4C1yB2euDTsN.TKUrej2W./iOGll7N50.AzdwK3e5CkA8WV680Gnq', 'USER', 'ACTIVE', '2026-10-01 21:31:55', '2026-10-01 21:30:44', '2026-10-05 19:46:30');

--
-- Indexes for dumped tables
--

--
-- Indexes for table `answer_options`
--
ALTER TABLE `answer_options`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `uk_answer_options_question_code` (`question_id`,`option_code`),
  ADD UNIQUE KEY `uk_answer_options_question_order` (`question_id`,`option_order`),
  ADD UNIQUE KEY `uk_answer_options_id_question` (`id`,`question_id`),
  ADD KEY `idx_answer_options_question` (`question_id`),
  ADD KEY `idx_answer_options_image` (`image_attachment_id`);

--
-- Indexes for table `assessments`
--
ALTER TABLE `assessments`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_assessments_listing` (`type`,`access_type`,`is_released`),
  ADD KEY `idx_assessments_released` (`is_released`);

--
-- Indexes for table `attachments`
--
ALTER TABLE `attachments`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_attachments_mime_type` (`mime_type`);

--
-- Indexes for table `attempts`
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
-- Indexes for table `attempt_answers`
--
ALTER TABLE `attempt_answers`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `uk_attempt_answers_attempt_question` (`attempt_id`,`question_id`),
  ADD KEY `idx_attempt_answers_question` (`question_id`),
  ADD KEY `idx_attempt_answers_selected_option` (`selected_option_id`),
  ADD KEY `fk_attempt_answers_option_question` (`selected_option_id`,`question_id`);

--
-- Indexes for table `attempt_results`
--
ALTER TABLE `attempt_results`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `uk_attempt_results_attempt` (`attempt_id`),
  ADD KEY `idx_attempt_results_total_score` (`total_score`),
  ADD KEY `idx_attempt_results_twk_score` (`twk_score`),
  ADD KEY `idx_attempt_results_tiu_score` (`tiu_score`),
  ADD KEY `idx_attempt_results_tkp_score` (`tkp_score`);

--
-- Indexes for table `email_verification_tokens`
--
ALTER TABLE `email_verification_tokens`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `uq_email_verification_tokens_token_hash` (`token_hash`),
  ADD KEY `idx_email_verification_tokens_user_id` (`user_id`),
  ADD KEY `idx_email_verification_tokens_expires_at` (`expires_at`);

--
-- Indexes for table `feedbacks`
--
ALTER TABLE `feedbacks`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_feedbacks_user` (`user_id`),
  ADD KEY `idx_feedbacks_assessment` (`assessment_id`),
  ADD KEY `idx_feedbacks_rating` (`rating`);

--
-- Indexes for table `materials`
--
ALTER TABLE `materials`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_materials_access_type` (`access_type`),
  ADD KEY `fk_materials_attachment` (`attachment_id`);

--
-- Indexes for table `password_reset_tokens`
--
ALTER TABLE `password_reset_tokens`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `uq_password_reset_tokens_token_hash` (`token_hash`),
  ADD KEY `idx_password_reset_tokens_user_id` (`user_id`),
  ADD KEY `idx_password_reset_tokens_expires_at` (`expires_at`);

--
-- Indexes for table `questions`
--
ALTER TABLE `questions`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `uk_questions_package_number` (`question_package_id`,`question_number`),
  ADD KEY `idx_questions_package` (`question_package_id`),
  ADD KEY `idx_questions_type` (`question_type_id`),
  ADD KEY `idx_questions_image` (`image_attachment_id`),
  ADD KEY `idx_questions_explanation_attachment` (`explanation_attachment_id`);

--
-- Indexes for table `question_packages`
--
ALTER TABLE `question_packages`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `uk_question_packages_assessment` (`assessment_id`),
  ADD UNIQUE KEY `uk_question_packages_id_assessment` (`id`,`assessment_id`);

--
-- Indexes for table `question_types`
--
ALTER TABLE `question_types`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `uk_question_types_code` (`code`);

--
-- Indexes for table `subscriptions`
--
ALTER TABLE `subscriptions`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `uk_subscriptions_active_user` (`active_user_id`),
  ADD KEY `idx_subscriptions_user_id` (`user_id`),
  ADD KEY `idx_subscriptions_status` (`status`),
  ADD KEY `idx_subscriptions_expired_at` (`expired_at`);

--
-- Indexes for table `transactions`
--
ALTER TABLE `transactions`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `uk_transactions_order_id` (`order_id`),
  ADD KEY `idx_transactions_user_id` (`user_id`),
  ADD KEY `idx_transactions_status` (`status`),
  ADD KEY `idx_transactions_created_at` (`created_at`),
  ADD KEY `idx_transactions_midtrans_transaction_id` (`midtrans_transaction_id`);

--
-- Indexes for table `users`
--
ALTER TABLE `users`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `uk_users_email` (`email`),
  ADD KEY `idx_users_role` (`role`);

--
-- AUTO_INCREMENT for dumped tables
--

--
-- AUTO_INCREMENT for table `answer_options`
--
ALTER TABLE `answer_options`
  MODIFY `id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `assessments`
--
ALTER TABLE `assessments`
  MODIFY `id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `attachments`
--
ALTER TABLE `attachments`
  MODIFY `id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `attempts`
--
ALTER TABLE `attempts`
  MODIFY `id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `attempt_answers`
--
ALTER TABLE `attempt_answers`
  MODIFY `id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `attempt_results`
--
ALTER TABLE `attempt_results`
  MODIFY `id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `email_verification_tokens`
--
ALTER TABLE `email_verification_tokens`
  MODIFY `id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `feedbacks`
--
ALTER TABLE `feedbacks`
  MODIFY `id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `materials`
--
ALTER TABLE `materials`
  MODIFY `id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=5;

--
-- AUTO_INCREMENT for table `password_reset_tokens`
--
ALTER TABLE `password_reset_tokens`
  MODIFY `id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=2;

--
-- AUTO_INCREMENT for table `questions`
--
ALTER TABLE `questions`
  MODIFY `id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `question_packages`
--
ALTER TABLE `question_packages`
  MODIFY `id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=14;

--
-- AUTO_INCREMENT for table `question_types`
--
ALTER TABLE `question_types`
  MODIFY `id` tinyint(3) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=4;

--
-- AUTO_INCREMENT for table `subscriptions`
--
ALTER TABLE `subscriptions`
  MODIFY `id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `transactions`
--
ALTER TABLE `transactions`
  MODIFY `id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `users`
--
ALTER TABLE `users`
  MODIFY `id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=4;

--
-- Constraints for dumped tables
--

--
-- Constraints for table `answer_options`
--
ALTER TABLE `answer_options`
  ADD CONSTRAINT `fk_answer_options_image` FOREIGN KEY (`image_attachment_id`) REFERENCES `attachments` (`id`) ON UPDATE CASCADE,
  ADD CONSTRAINT `fk_answer_options_question` FOREIGN KEY (`question_id`) REFERENCES `questions` (`id`) ON UPDATE CASCADE;

--
-- Constraints for table `attempts`
--
ALTER TABLE `attempts`
  ADD CONSTRAINT `fk_attempts_package_assessment` FOREIGN KEY (`question_package_id`,`assessment_id`) REFERENCES `question_packages` (`id`, `assessment_id`) ON UPDATE CASCADE,
  ADD CONSTRAINT `fk_attempts_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON UPDATE CASCADE;

--
-- Constraints for table `attempt_answers`
--
ALTER TABLE `attempt_answers`
  ADD CONSTRAINT `fk_attempt_answers_attempt` FOREIGN KEY (`attempt_id`) REFERENCES `attempts` (`id`) ON UPDATE CASCADE,
  ADD CONSTRAINT `fk_attempt_answers_option_question` FOREIGN KEY (`selected_option_id`,`question_id`) REFERENCES `answer_options` (`id`, `question_id`) ON UPDATE CASCADE,
  ADD CONSTRAINT `fk_attempt_answers_question` FOREIGN KEY (`question_id`) REFERENCES `questions` (`id`) ON UPDATE CASCADE;

--
-- Constraints for table `attempt_results`
--
ALTER TABLE `attempt_results`
  ADD CONSTRAINT `fk_attempt_results_attempt` FOREIGN KEY (`attempt_id`) REFERENCES `attempts` (`id`) ON UPDATE CASCADE;

--
-- Constraints for table `email_verification_tokens`
--
ALTER TABLE `email_verification_tokens`
  ADD CONSTRAINT `fk_email_verification_tokens_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE;

--
-- Constraints for table `feedbacks`
--
ALTER TABLE `feedbacks`
  ADD CONSTRAINT `fk_feedbacks_assessment` FOREIGN KEY (`assessment_id`) REFERENCES `assessments` (`id`) ON UPDATE CASCADE,
  ADD CONSTRAINT `fk_feedbacks_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON UPDATE CASCADE;

--
-- Constraints for table `materials`
--
ALTER TABLE `materials`
  ADD CONSTRAINT `fk_materials_attachment` FOREIGN KEY (`attachment_id`) REFERENCES `attachments` (`id`) ON UPDATE CASCADE;

--
-- Constraints for table `password_reset_tokens`
--
ALTER TABLE `password_reset_tokens`
  ADD CONSTRAINT `fk_password_reset_tokens_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE;

--
-- Constraints for table `questions`
--
ALTER TABLE `questions`
  ADD CONSTRAINT `fk_questions_explanation_attachment` FOREIGN KEY (`explanation_attachment_id`) REFERENCES `attachments` (`id`) ON UPDATE CASCADE,
  ADD CONSTRAINT `fk_questions_image` FOREIGN KEY (`image_attachment_id`) REFERENCES `attachments` (`id`) ON UPDATE CASCADE,
  ADD CONSTRAINT `fk_questions_package` FOREIGN KEY (`question_package_id`) REFERENCES `question_packages` (`id`) ON UPDATE CASCADE,
  ADD CONSTRAINT `fk_questions_type` FOREIGN KEY (`question_type_id`) REFERENCES `question_types` (`id`) ON UPDATE CASCADE;

--
-- Constraints for table `question_packages`
--
ALTER TABLE `question_packages`
  ADD CONSTRAINT `fk_question_packages_assessment` FOREIGN KEY (`assessment_id`) REFERENCES `assessments` (`id`) ON UPDATE CASCADE;

--
-- Constraints for table `subscriptions`
--
ALTER TABLE `subscriptions`
  ADD CONSTRAINT `fk_subscriptions_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON UPDATE CASCADE;

--
-- Constraints for table `transactions`
--
ALTER TABLE `transactions`
  ADD CONSTRAINT `fk_transactions_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON UPDATE CASCADE;
COMMIT;

/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
