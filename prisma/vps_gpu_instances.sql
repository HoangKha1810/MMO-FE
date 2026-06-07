CREATE TABLE IF NOT EXISTS `vps_gpu_instances` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `user_id` INT NOT NULL,
  `provider_instance_id` VARCHAR(80) NOT NULL,
  `offer_id` VARCHAR(80) NOT NULL,
  `instance_name` VARCHAR(255) NULL,
  `status` VARCHAR(40) NOT NULL DEFAULT 'active',
  `provider_status` VARCHAR(80) NULL,
  `cost_hourly_usd` DECIMAL(14,6) NOT NULL DEFAULT 0,
  `cost_hourly_vnd` DECIMAL(15,2) NOT NULL DEFAULT 0,
  `sale_hourly_vnd` DECIMAL(15,2) NOT NULL DEFAULT 0,
  `total_charged_vnd` DECIMAL(15,2) NOT NULL DEFAULT 0,
  `internet_charged_usd` DECIMAL(14,6) NOT NULL DEFAULT 0,
  `internet_charged_vnd` DECIMAL(15,2) NOT NULL DEFAULT 0,
  `last_usage_sync_at` DATETIME NULL,
  `last_usage_sync_at_ms` BIGINT NULL,
  `started_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `started_at_ms` BIGINT NULL,
  `next_charge_at` DATETIME NOT NULL,
  `next_charge_at_ms` BIGINT NULL,
  `last_charged_at` DATETIME NULL,
  `last_charged_at_ms` BIGINT NULL,
  `low_balance_warning_for_at` DATETIME NULL,
  `low_balance_warning_for_at_ms` BIGINT NULL,
  `ended_at` DATETIME NULL,
  `ended_at_ms` BIGINT NULL,
  `end_reason` VARCHAR(255) NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uniq_vps_gpu_provider_instance` (`provider_instance_id`),
  KEY `idx_vps_gpu_user_status` (`user_id`, `status`),
  KEY `idx_vps_gpu_next_charge` (`status`, `next_charge_at`),
  KEY `idx_vps_gpu_next_charge_ms` (`status`, `next_charge_at_ms`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

ALTER TABLE `vps_gpu_instances`
  ADD COLUMN IF NOT EXISTS `low_balance_warning_for_at` DATETIME NULL AFTER `last_charged_at`;

ALTER TABLE `vps_gpu_instances`
  ADD COLUMN IF NOT EXISTS `internet_charged_usd` DECIMAL(14,6) NOT NULL DEFAULT 0 AFTER `total_charged_vnd`,
  ADD COLUMN IF NOT EXISTS `internet_charged_vnd` DECIMAL(15,2) NOT NULL DEFAULT 0 AFTER `internet_charged_usd`,
  ADD COLUMN IF NOT EXISTS `last_usage_sync_at` DATETIME NULL AFTER `internet_charged_vnd`,
  ADD COLUMN IF NOT EXISTS `last_usage_sync_at_ms` BIGINT NULL AFTER `last_usage_sync_at`;

ALTER TABLE `vps_gpu_instances`
  ADD COLUMN IF NOT EXISTS `started_at_ms` BIGINT NULL AFTER `started_at`,
  ADD COLUMN IF NOT EXISTS `next_charge_at_ms` BIGINT NULL AFTER `next_charge_at`,
  ADD COLUMN IF NOT EXISTS `last_charged_at_ms` BIGINT NULL AFTER `last_charged_at`,
  ADD COLUMN IF NOT EXISTS `low_balance_warning_for_at_ms` BIGINT NULL AFTER `low_balance_warning_for_at`,
  ADD COLUMN IF NOT EXISTS `ended_at_ms` BIGINT NULL AFTER `ended_at`;

ALTER TABLE `vps_gpu_instances`
  ADD KEY IF NOT EXISTS `idx_vps_gpu_next_charge_ms` (`status`, `next_charge_at_ms`);
