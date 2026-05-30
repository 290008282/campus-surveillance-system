-- Campus Surveillance System - Database Init Script

CREATE DATABASE IF NOT EXISTS `campus-surveillance-system` DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE `campus-surveillance-system`;

-- Users table
CREATE TABLE IF NOT EXISTS `users` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `username` VARCHAR(255) NOT NULL,
  `nickname` VARCHAR(255) NOT NULL,
  `role` VARCHAR(50) NOT NULL DEFAULT 'user',
  `avatar_file_path` VARCHAR(500) NULL,
  `tel` VARCHAR(50) NULL,
  `email` VARCHAR(255) NULL,
  `password` VARCHAR(255) NOT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `deleted_at` DATETIME NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_username` (`username`),
  KEY `idx_role` (`role`),
  KEY `idx_email` (`email`),
  KEY `idx_created_at` (`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Cameras table
CREATE TABLE IF NOT EXISTS `cameras` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `name` VARCHAR(255) NOT NULL,
  `code` VARCHAR(100) NOT NULL,
  `rtsp_url` VARCHAR(500) NOT NULL,
  `map_longitude` DOUBLE NOT NULL,
  `map_latitude` DOUBLE NOT NULL,
  `status` VARCHAR(50) NOT NULL DEFAULT 'offline',
  `model` VARCHAR(255) DEFAULT '',
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `deleted_at` DATETIME NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_code` (`code`),
  KEY `idx_status` (`status`),
  KEY `idx_name` (`name`),
  KEY `idx_location` (`map_latitude`, `map_longitude`),
  KEY `idx_created_at` (`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Alarm events table
CREATE TABLE IF NOT EXISTS `alarm_events` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `camera_id` INT NOT NULL,
  `alarm_rule_id` INT NOT NULL,
  `snap_url` VARCHAR(500) NULL,
  `description` TEXT NULL,
  `status` VARCHAR(50) NOT NULL DEFAULT 'pending',
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `deleted_at` DATETIME NULL,
  PRIMARY KEY (`id`),
  KEY `idx_camera_id` (`camera_id`),
  KEY `idx_alarm_rule_id` (`alarm_rule_id`),
  KEY `idx_status` (`status`),
  KEY `idx_created_at` (`created_at`),
  KEY `idx_camera_status` (`camera_id`, `status`),
  KEY `idx_created_status` (`created_at`, `status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Alarm rules table
CREATE TABLE IF NOT EXISTS `alarm_rules` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `name` VARCHAR(255) NOT NULL,
  `description` TEXT NULL,
  `model_class` VARCHAR(100) NOT NULL,
  `confidence_threshold` DOUBLE NOT NULL DEFAULT 0.5,
  `enabled` TINYINT NOT NULL DEFAULT 1,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `deleted_at` DATETIME NULL,
  PRIMARY KEY (`id`),
  KEY `idx_enabled` (`enabled`),
  KEY `idx_model_class` (`model_class`),
  KEY `idx_name` (`name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Map configs table
CREATE TABLE IF NOT EXISTS `map_configs` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `name` VARCHAR(255) NOT NULL,
  `map_type` VARCHAR(50) NOT NULL,
  `center_longitude` DOUBLE NOT NULL,
  `center_latitude` DOUBLE NOT NULL,
  `zoom` INT NOT NULL DEFAULT 18,
  `config_json` JSON NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `deleted_at` DATETIME NULL,
  PRIMARY KEY (`id`),
  KEY `idx_name` (`name`),
  KEY `idx_type` (`map_type`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Insert default admin user (password: admin)
INSERT INTO `users` (`username`, `nickname`, `role`, `password`)
SELECT 'admin', 'Administrator', 'admin', '$2b$10$rVYEj1KgxGx7PgxQzO5Nwu1YkLxI0zVxnFNGmP0zM0U0Kx7z5z6q'
WHERE NOT EXISTS (SELECT 1 FROM `users` WHERE `username` = 'admin');

-- Insert default alarm rules
INSERT INTO `alarm_rules` (`name`, `description`, `model_class`, `confidence_threshold`, `enabled`)
SELECT 'Person Detection', 'Detect person in camera frame', 'person', 0.6, 1
WHERE NOT EXISTS (SELECT 1 FROM `alarm_rules` WHERE `name` = 'Person Detection');

INSERT INTO `alarm_rules` (`name`, `description`, `model_class`, `confidence_threshold`, `enabled`)
SELECT 'Vehicle Detection', 'Detect vehicle in camera frame', 'car', 0.5, 1
WHERE NOT EXISTS (SELECT 1 FROM `alarm_rules` WHERE `name` = 'Vehicle Detection');

INSERT INTO `alarm_rules` (`name`, `description`, `model_class`, `confidence_threshold`, `enabled`)
SELECT 'Abnormal Behavior', 'Detect abnormal behavior', 'abnormal', 0.7, 1
WHERE NOT EXISTS (SELECT 1 FROM `alarm_rules` WHERE `name` = 'Abnormal Behavior');

-- Insert default map config
INSERT INTO `map_configs` (`name`, `map_type`, `center_longitude`, `center_latitude`, `zoom`, `config_json`)
SELECT 'Default Map', 'tile', 117.060, 36.195, 18, '{"url": "https://tile.openstreetmap.org/{z}/{x}/{y.png}"}'
WHERE NOT EXISTS (SELECT 1 FROM `map_configs` WHERE `name` = 'Default Map');

SELECT 'Database init complete!' AS status;