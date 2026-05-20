-- 鏅烘収鍥尯瑙嗛鐩戞帶绯荤粺 - 鏁版嵁搴撳垵濮嬪寲鑴氭湰
-- 鍒涘缓鏃堕棿: 2026-05-20

-- 鍒涘缓鏁版嵁搴?濡傛灉涓嶅瓨鍦?
CREATE DATABASE IF NOT EXISTS `campus-surveillance-system` DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE `campus-surveillance-system`;

-- ============================================
-- 鐢ㄦ埛琛?(users)
-- ============================================
CREATE TABLE IF NOT EXISTS `users` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `username` VARCHAR(255) NOT NULL COMMENT '鐢ㄦ埛鍚?,
  `nickname` VARCHAR(255) NOT NULL COMMENT '鏄电О',
  `role` VARCHAR(50) NOT NULL DEFAULT 'user' COMMENT '瑙掕壊: admin/user',
  `avatar_file_path` VARCHAR(500) NULL COMMENT '澶村儚璺緞',
  `tel` VARCHAR(50) NULL COMMENT '鐢佃瘽',
  `email` VARCHAR(255) NULL COMMENT '閭',
  `password` VARCHAR(255) NOT NULL COMMENT '瀵嗙爜(瀛樺偍鍝堝笇鍊?',
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '鍒涘缓鏃堕棿',
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '鏇存柊鏃堕棿',
  `deleted_at` DATETIME NULL COMMENT '鍒犻櫎鏃堕棿',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_username` (`username`),
  KEY `idx_role` (`role`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='鐢ㄦ埛琛?;

-- ============================================
-- 鎽勫儚澶磋〃 (cameras)
-- ============================================
CREATE TABLE IF NOT EXISTS `cameras` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `name` VARCHAR(255) NOT NULL COMMENT '鎽勫儚澶村悕绉?,
  `code` VARCHAR(100) NOT NULL COMMENT '鎽勫儚澶寸紪鐮?,
  `rtsp_url` VARCHAR(500) NOT NULL COMMENT 'RTSP 娴佸湴鍧€',
  `map_longitude` DOUBLE NOT NULL COMMENT '鍦板浘缁忓害',
  `map_latitude` DOUBLE NOT NULL COMMENT '鍦板浘绾害',
  `status` VARCHAR(50) NOT NULL DEFAULT 'offline' COMMENT '鐘舵€? online/offline/error',
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `deleted_at` DATETIME NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_code` (`code`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='鎽勫儚澶磋〃';

-- ============================================
-- 鎶ヨ浜嬩欢琛?(alarm_events)
-- ============================================
CREATE TABLE IF NOT EXISTS `alarm_events` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `camera_id` INT NOT NULL COMMENT '鎽勫儚澶碔D',
  `alarm_rule_id` INT NOT NULL COMMENT '鎶ヨ瑙勫垯ID',
  `snap_url` VARCHAR(500) NULL COMMENT '蹇収URL',
  `description` TEXT NULL COMMENT '鎻忚堪',
  `status` VARCHAR(50) NOT NULL DEFAULT 'pending' COMMENT '鐘舵€? pending/handled/ignored',
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `deleted_at` DATETIME NULL,
  PRIMARY KEY (`id`),
  KEY `idx_camera_id` (`camera_id`),
  KEY `idx_status` (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='鎶ヨ浜嬩欢琛?;

-- ============================================
-- 鎶ヨ瑙勫垯琛?(alarm_rules)
-- ============================================
CREATE TABLE IF NOT EXISTS `alarm_rules` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `name` VARCHAR(255) NOT NULL COMMENT '瑙勫垯鍚嶇О',
  `description` TEXT NULL COMMENT '瑙勫垯鎻忚堪',
  `model_class` VARCHAR(100) NOT NULL COMMENT '妫€娴嬬被鍒?,
  `confidence_threshold` DOUBLE NOT NULL DEFAULT 0.5 COMMENT '缃俊搴﹂槇鍊?,
  `enabled` TINYINT NOT NULL DEFAULT 1 COMMENT '鏄惁鍚敤',
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `deleted_at` DATETIME NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='鎶ヨ瑙勫垯琛?;

-- ============================================
-- 鍦板浘閰嶇疆琛?(map_configs)
-- ============================================
CREATE TABLE IF NOT EXISTS `map_configs` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `name` VARCHAR(255) NOT NULL COMMENT '閰嶇疆鍚嶇О',
  `map_type` VARCHAR(50) NOT NULL COMMENT '鍦板浘绫诲瀷: tile/custom',
  `center_longitude` DOUBLE NOT NULL COMMENT '涓績缁忓害',
  `center_latitude` DOUBLE NOT NULL COMMENT '涓績绾害',
  `zoom` INT NOT NULL DEFAULT 18 COMMENT '缂╂斁绾у埆',
  `config_json` JSON NULL COMMENT '閰嶇疆JSON',
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `deleted_at` DATETIME NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='鍦板浘閰嶇疆琛?;

-- ============================================
-- 鍒濆鍖栭粯璁ょ鐞嗗憳璐﹀彿
-- 瀵嗙爜: admin (bcrypt 鍝堝笇)
-- ============================================
INSERT INTO `users` (`username`, `nickname`, `role`, `password`)
SELECT 'admin', '绠＄悊鍛?, 'admin', '$2b$10$rVYEj1KgxGx7PgxQzO5Nwu1YkLxI0zVxnFNGmP0zM0U0Kx7z5z6q'
WHERE NOT EXISTS (SELECT 1 FROM `users` WHERE `username` = 'admin');

-- ============================================
-- 鍒濆鍖栭粯璁ゆ姤璀﹁鍒?-- ============================================
INSERT INTO `alarm_rules` (`name`, `description`, `model_class`, `confidence_threshold`, `enabled`)
SELECT '浜鸿劯妫€娴?, '妫€娴嬫憚鍍忓ご鐢婚潰涓嚭鐜扮殑浜鸿劯', 'person', 0.6, 1
WHERE NOT EXISTS (SELECT 1 FROM `alarm_rules` WHERE `name` = '浜鸿劯妫€娴?);

INSERT INTO `alarm_rules` (`name`, `description`, `model_class`, `confidence_threshold`, `enabled`)
SELECT '杞﹁締妫€娴?, '妫€娴嬫憚鍍忓ご鐢婚潰涓嚭鐜扮殑杞﹁締', 'car', 0.5, 1
WHERE NOT EXISTS (SELECT 1 FROM `alarm_rules` WHERE `name` = '杞﹁締妫€娴?);

INSERT INTO `alarm_rules` (`name`, `description`, `model_class`, `confidence_threshold`, `enabled`)
SELECT '寮傚父琛屼负妫€娴?, '妫€娴嬪紓甯歌涓?, '寮傚父琛屼负', 0.7, 1
WHERE NOT EXISTS (SELECT 1 FROM `alarm_rules` WHERE `name` = '寮傚父琛屼负妫€娴?);

-- ============================================
-- 鍒濆鍖栭粯璁ゅ湴鍥鹃厤缃?-- ============================================
INSERT INTO `map_configs` (`name`, `map_type`, `center_longitude`, `center_latitude`, `zoom`, `config_json`)
SELECT '榛樿鍦板浘', 'tile', 117.060, 36.195, 18, '{"url": "https://tile.openstreetmap.org/{z}/{x}/{y.png}"}'
WHERE NOT EXISTS (SELECT 1 FROM `map_configs` WHERE `name` = '榛樿鍦板浘');

SELECT '鏁版嵁搴撳垵濮嬪寲瀹屾垚!' AS status;