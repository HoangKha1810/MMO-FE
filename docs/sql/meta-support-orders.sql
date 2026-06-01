CREATE TABLE IF NOT EXISTS meta_support_orders (
  id INT NOT NULL AUTO_INCREMENT,
  user_id INT NOT NULL,
  contact VARCHAR(255) NOT NULL,
  gmail TEXT NOT NULL,
  quantity INT NOT NULL DEFAULT 1,
  price DECIMAL(15,2) NOT NULL DEFAULT 0,
  note TEXT NULL,
  admin_note TEXT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'pending',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_meta_support_user_status (user_id, status),
  KEY idx_meta_support_updated (updated_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
