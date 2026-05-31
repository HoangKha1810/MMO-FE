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
  `started_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `next_charge_at` DATETIME NOT NULL,
  `last_charged_at` DATETIME NULL,
  `low_balance_warning_for_at` DATETIME NULL,
  `ended_at` DATETIME NULL,
  `end_reason` VARCHAR(255) NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uniq_vps_gpu_provider_instance` (`provider_instance_id`),
  KEY `idx_vps_gpu_user_status` (`user_id`, `status`),
  KEY `idx_vps_gpu_next_charge` (`status`, `next_charge_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

ALTER TABLE `vps_gpu_instances`
  ADD COLUMN IF NOT EXISTS `low_balance_warning_for_at` DATETIME NULL AFTER `last_charged_at`;
