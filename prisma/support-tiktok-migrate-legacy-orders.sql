SET NAMES utf8mb4;

SET @has_old_table := (
  SELECT COUNT(*)
  FROM information_schema.tables
  WHERE table_schema = DATABASE()
    AND table_name = 'support_tiktok_orders'
);

SET @sql := IF(
  @has_old_table > 0,
  "INSERT INTO `tiktok_support_orders`
    (`user_id`, `region`, `service_key`, `service_name`, `tiktok_id`, `buyer_name`, `buyer_contact`, `price`, `status`, `ngay_gia_han`, `ngay_het_han`, `created_at`, `updated_at`)
  SELECT
    old_src.`user_id`,
    'legacy',
    COALESCE(NULLIF(old_src.`service_type`, ''), 'legacy'),
    COALESCE(NULLIF(old_src.`service_type`, ''), 'Legacy Support TikTok'),
    old_src.`tiktok_id`,
    NULL,
    NULL,
    COALESCE(old_src.`price`, 0),
    COALESCE(NULLIF(old_src.`status`, ''), 'pending'),
    old_src.`created_at`,
    DATE_ADD(COALESCE(old_src.`updated_at`, old_src.`created_at`), INTERVAL 30 DAY),
    old_src.`created_at`,
    COALESCE(old_src.`updated_at`, old_src.`created_at`)
  FROM `support_tiktok_orders` old_src
  WHERE NOT EXISTS (
    SELECT 1
    FROM `tiktok_support_orders` new_dst
    WHERE new_dst.`user_id` = old_src.`user_id`
      AND new_dst.`tiktok_id` = old_src.`tiktok_id`
      AND new_dst.`created_at` = old_src.`created_at`
  )",
  "SELECT 'Bo qua migrate: khong tim thay bang support_tiktok_orders trong database hien tai.' AS message"
);

PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SELECT
  @has_old_table AS has_old_table,
  (SELECT COUNT(*) FROM `tiktok_support_orders`) AS current_tiktok_support_orders;
