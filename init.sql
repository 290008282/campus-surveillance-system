-- 智慧园区视频监控系统 - 数据库初始化脚本
-- 创建时间: 2026-05-20

-- 创建数据库(如果不存在)
CREATE DATABASE IF NOT EXISTS `campus-surveillance-system` DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE `campus-surveillance-system`;

-- ============================================
-- 用户表 (users)
-- ============================================
CREATE TABLE IF NOT EXISTS `users` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `username` VARCHAR(255) NOT NULL COMMENT '用户名',
  `nickname` VARCHAR(255) NOT NULL COMMENT '昵称',
  `role` VARCHAR(50) NOT NULL DEFAULT 'user' COMMENT '角色: admin/user',
  `avatar_file_path` VARCHAR(500) NULL COMMENT '头像路径',
  `tel` VARCHAR(50) NULL COMMENT '电话',
  `email` VARCHAR(255) NULL COMMENT '邮箱',
  `password` VARCHAR(255) NOT NULL COMMENT '密码(存储哈希值)',
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  `deleted_at` DATETIME NULL COMMENT '删除时间',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_username` (`username`),
  KEY `idx_role` (`role`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='用户表';

-- ============================================
-- 摄像头表 (cameras)
-- ============================================
CREATE TABLE IF NOT EXISTS `cameras` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `name` VARCHAR(255) NOT NULL COMMENT '摄像头名称',
  `code` VARCHAR(100) NOT NULL COMMENT '摄像头编码',
  `rtsp_url` VARCHAR(500) NOT NULL COMMENT 'RTSP 流地址',
  `map_longitude` DOUBLE NOT NULL COMMENT '地图经度',
  `map_latitude` DOUBLE NOT NULL COMMENT '地图纬度',
  `status` VARCHAR(50) NOT NULL DEFAULT 'offline' COMMENT '状态: online/offline/error',
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `deleted_at` DATETIME NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_code` (`code`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='摄像头表';

-- ============================================
-- 报警事件表 (alarm_events)
-- ============================================
CREATE TABLE IF NOT EXISTS `alarm_events` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `camera_id` INT NOT NULL COMMENT '摄像头ID',
  `alarm_rule_id` INT NOT NULL COMMENT '报警规则ID',
  `snap_url` VARCHAR(500) NULL COMMENT '快照URL',
  `description` TEXT NULL COMMENT '描述',
  `status` VARCHAR(50) NOT NULL DEFAULT 'pending' COMMENT '状态: pending/handled/ignored',
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `deleted_at` DATETIME NULL,
  PRIMARY KEY (`id`),
  KEY `idx_camera_id` (`camera_id`),
  KEY `idx_status` (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='报警事件表';

-- ============================================
-- 报警规则表 (alarm_rules)
-- ============================================
CREATE TABLE IF NOT EXISTS `alarm_rules` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `name` VARCHAR(255) NOT NULL COMMENT '规则名称',
  `description` TEXT NULL COMMENT '规则描述',
  `model_class` VARCHAR(100) NOT NULL COMMENT '检测类别',
  `confidence_threshold` DOUBLE NOT NULL DEFAULT 0.5 COMMENT '置信度阈值',
  `enabled` TINYINT NOT NULL DEFAULT 1 COMMENT '是否启用',
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `deleted_at` DATETIME NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='报警规则表';

-- ============================================
-- 地图配置表 (map_configs)
-- ============================================
CREATE TABLE IF NOT EXISTS `map_configs` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `name` VARCHAR(255) NOT NULL COMMENT '配置名称',
  `map_type` VARCHAR(50) NOT NULL COMMENT '地图类型: tile/custom',
  `center_longitude` DOUBLE NOT NULL COMMENT '中心经度',
  `center_latitude` DOUBLE NOT NULL COMMENT '中心纬度',
  `zoom` INT NOT NULL DEFAULT 18 COMMENT '缩放级别',
  `config_json` JSON NULL COMMENT '配置JSON',
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `deleted_at` DATETIME NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='地图配置表';

-- ============================================
-- 初始化默认管理员账号
-- 密码: admin (bcrypt 哈希)
-- ============================================
INSERT INTO `users` (`username`, `nickname`, `role`, `password`)
SELECT 'admin', '管理员', 'admin', '$2b$10$rVYEj1KgxGx7PgxQzO5Nwu1YkLxI0zVxnFNGmP0zM0U0Kx7z5z6q'
WHERE NOT EXISTS (SELECT 1 FROM `users` WHERE `username` = 'admin');

-- ============================================
-- 初始化默认报警规则
-- ============================================
INSERT INTO `alarm_rules` (`name`, `description`, `model_class`, `confidence_threshold`, `enabled`)
SELECT '人脸检测', '检测摄像头画面中出现的人脸', 'person', 0.6, 1
WHERE NOT EXISTS (SELECT 1 FROM `alarm_rules` WHERE `name` = '人脸检测');

INSERT INTO `alarm_rules` (`name`, `description`, `model_class`, `confidence_threshold`, `enabled`)
SELECT '车辆检测', '检测摄像头画面中出现的车辆', 'car', 0.5, 1
WHERE NOT EXISTS (SELECT 1 FROM `alarm_rules` WHERE `name` = '车辆检测');

INSERT INTO `alarm_rules` (`name`, `description`, `model_class`, `confidence_threshold`, `enabled`)
SELECT '异常行为检测', '检测异常行为', '异常行为', 0.7, 1
WHERE NOT EXISTS (SELECT 1 FROM `alarm_rules` WHERE `name` = '异常行为检测');

-- ============================================
-- 初始化默认地图配置
-- ============================================
INSERT INTO `map_configs` (`name`, `map_type`, `center_longitude`, `center_latitude`, `zoom`, `config_json`)
SELECT '默认地图', 'tile', 117.060, 36.195, 18, '{"url": "https://tile.openstreetmap.org/{z}/{x}/{y.png}"}'
WHERE NOT EXISTS (SELECT 1 FROM `map_configs` WHERE `name` = '默认地图');

SELECT '数据库初始化完成!' AS status;