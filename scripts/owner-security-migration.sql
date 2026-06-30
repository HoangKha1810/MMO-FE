ALTER TABLE `users`
  MODIFY `role` ENUM('owner','member','user','admin','sellermarket','support_tiktok') NULL DEFAULT 'member';

CREATE TABLE IF NOT EXISTS owner_security_events (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id INT NULL,
  username VARCHAR(100) NULL,
  email VARCHAR(190) NULL,
  event_type VARCHAR(80) NOT NULL,
  layer VARCHAR(60) NOT NULL,
  verdict VARCHAR(40) NOT NULL,
  risk_score INT NOT NULL DEFAULT 0,
  reason TEXT NULL,
  ip_address VARCHAR(45) NULL,
  user_agent TEXT NULL,
  device_hash VARCHAR(96) NULL,
  request_path VARCHAR(255) NULL,
  request_method VARCHAR(16) NULL,
  details LONGTEXT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_owner_security_user_created (user_id, created_at),
  KEY idx_owner_security_event_created (event_type, created_at),
  KEY idx_owner_security_ip_created (ip_address, created_at),
  KEY idx_owner_security_device_created (device_hash, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS owner_trusted_devices (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id INT NOT NULL,
  device_hash VARCHAR(96) NOT NULL,
  label VARCHAR(190) NULL,
  user_agent TEXT NULL,
  first_ip VARCHAR(45) NULL,
  last_ip VARCHAR(45) NULL,
  trust_level VARCHAR(40) NOT NULL DEFAULT 'owner_manual',
  first_seen_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  last_seen_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  revoked_at TIMESTAMP NULL DEFAULT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uniq_owner_device (user_id, device_hash),
  KEY idx_owner_trusted_devices_user (user_id),
  KEY idx_owner_trusted_devices_ip (last_ip)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
