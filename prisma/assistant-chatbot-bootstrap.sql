SET NAMES utf8mb4;

CREATE TABLE IF NOT EXISTS `assistant_conversations` (
  `id` varchar(36) NOT NULL,
  `user_id` int NOT NULL,
  `audience` varchar(20) NOT NULL,
  `title` varchar(255) NOT NULL,
  `created_at` datetime NOT NULL,
  `updated_at` datetime NOT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_assistant_conversations_user_audience_updated` (`user_id`, `audience`, `updated_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `assistant_messages` (
  `id` varchar(36) NOT NULL,
  `conversation_id` varchar(36) NOT NULL,
  `role` varchar(20) NOT NULL,
  `content` mediumtext NOT NULL,
  `created_at` datetime NOT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_assistant_messages_conversation_created` (`conversation_id`, `created_at`),
  CONSTRAINT `fk_assistant_messages_conversation`
    FOREIGN KEY (`conversation_id`) REFERENCES `assistant_conversations` (`id`)
    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
