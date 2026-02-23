-- ========================================================
-- 用户表 (wte_users)
-- 存储小程序用户信息，每个微信用户对应一条记录
-- ========================================================

CREATE TABLE IF NOT EXISTS `wte_users` (
    -- 主键ID，自增
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '用户ID，主键',
    
    -- 微信相关字段
    `openid` VARCHAR(100) NOT NULL COMMENT '微信用户唯一标识openid',
    `unionid` VARCHAR(100) DEFAULT NULL COMMENT '微信unionid，用于多应用互通',
    
    -- 用户信息字段
    `nickname` VARCHAR(100) DEFAULT NULL COMMENT '用户昵称',
    `avatar_url` VARCHAR(500) DEFAULT NULL COMMENT '用户头像URL',
    
    -- 状态字段
    `status` TINYINT UNSIGNED NOT NULL DEFAULT '1' COMMENT '用户状态：1-正常，0-禁用',
    
    -- 时间戳字段
    `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
    `last_login_at` TIMESTAMP DEFAULT NULL COMMENT '最后登录时间',
    
    -- 主键约束
    PRIMARY KEY (`id`),
    
    -- 唯一索引：openid唯一
    UNIQUE KEY `uk_openid` (`openid`),
    
    -- 普通索引
    KEY `idx_unionid` (`unionid`),
    KEY `idx_status` (`status`),
    KEY `idx_created_at` (`created_at`)
    
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='用户表-存储小程序用户信息';
