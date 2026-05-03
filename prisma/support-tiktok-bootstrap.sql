SET NAMES utf8mb4;

CREATE TABLE IF NOT EXISTS `support_tiktok_messages` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `user_id` INT NOT NULL,
  `sender_type` ENUM('user', 'support') NOT NULL DEFAULT 'user',
  `message` TEXT NULL,
  `image_url` VARCHAR(255) NULL,
  `image_urls` LONGTEXT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_support_tiktok_messages_user_id` (`user_id`, `id`),
  KEY `idx_support_tiktok_messages_created_at` (`created_at`),
  CONSTRAINT `fk_support_tiktok_messages_user`
    FOREIGN KEY (`user_id`) REFERENCES `users` (`id`)
    ON DELETE CASCADE
    ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

ALTER TABLE `support_tiktok_messages`
  MODIFY COLUMN `image_url` LONGTEXT NULL;

CREATE TABLE IF NOT EXISTS `tiktok_service_menus` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `name` VARCHAR(150) NOT NULL,
  `slug` VARCHAR(120) NOT NULL,
  `display_order` INT NOT NULL DEFAULT 0,
  `status` VARCHAR(20) NOT NULL DEFAULT 'active',
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_tiktok_service_menus_slug` (`slug`),
  KEY `idx_tiktok_service_menus_status` (`status`, `display_order`, `id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `tiktok_region_services` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `region_slug` VARCHAR(120) NOT NULL,
  `name` VARCHAR(200) NOT NULL,
  `service_key` VARCHAR(120) NOT NULL,
  `price` DECIMAL(15,2) NOT NULL DEFAULT 0.00,
  `description` TEXT NULL,
  `display_order` INT NOT NULL DEFAULT 0,
  `status` VARCHAR(20) NOT NULL DEFAULT 'active',
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_tiktok_region_services_region_key` (`region_slug`, `service_key`),
  KEY `idx_tiktok_region_services_status` (`status`, `region_slug`, `display_order`, `id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `tiktok_support_orders` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `user_id` INT NOT NULL,
  `region` VARCHAR(120) NULL,
  `service_key` VARCHAR(120) NULL,
  `service_name` VARCHAR(255) NULL,
  `tiktok_id` VARCHAR(150) NOT NULL,
  `buyer_name` VARCHAR(150) NULL,
  `buyer_contact` VARCHAR(150) NULL,
  `price` DECIMAL(15,2) NOT NULL DEFAULT 0.00,
  `status` VARCHAR(20) NOT NULL DEFAULT 'pending',
  `ngay_gia_han` DATETIME NULL,
  `ngay_het_han` DATETIME NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_tiktok_support_orders_user_status` (`user_id`, `status`),
  KEY `idx_tiktok_support_orders_updated_at` (`updated_at`, `id`),
  KEY `idx_tiktok_support_orders_service` (`service_key`, `status`),
  CONSTRAINT `fk_tiktok_support_orders_user`
    FOREIGN KEY (`user_id`) REFERENCES `users` (`id`)
    ON DELETE CASCADE
    ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Seed mau de mo module ngay neu ban chua co du lieu.
INSERT INTO `tiktok_service_menus` (`name`, `slug`, `display_order`, `status`)
SELECT 'TikTok Viet Nam', 'vn', 1, 'active'
WHERE NOT EXISTS (
  SELECT 1 FROM `tiktok_service_menus` WHERE `slug` = 'vn'
);

INSERT INTO `tiktok_region_services` (`region_slug`, `name`, `service_key`, `price`, `description`, `display_order`, `status`)
SELECT
  'vn',
  'Support TikTok co ban',
  'support-basic',
  50000.00,
  'Goi mac dinh de test module Support TikTok sau khi tao bang.',
  1,
  'active'
WHERE NOT EXISTS (
  SELECT 1
  FROM `tiktok_region_services`
  WHERE `region_slug` = 'vn' AND `service_key` = 'support-basic'
);
