-- ======================================================== 
-- 厨房表 (wte_kitchens)
-- 存储厨房信息，每个用户可以创建多个厨房
-- 用于组织和管理菜品、点餐活动
-- ========================================================

CREATE TABLE IF NOT EXISTS `wte_kitchens` (
    -- 主键ID，自增
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '厨房ID，主键',
    
    -- 关联字段
    `user_id` BIGINT UNSIGNED NOT NULL COMMENT '创建者用户ID，关联wte_users.id',
    
    -- 厨房信息字段
    `name` VARCHAR(100) NOT NULL COMMENT '厨房名称',
    `description` TEXT DEFAULT NULL COMMENT '厨房描述/备注',
    `is_default` TINYINT UNSIGNED NOT NULL DEFAULT '0' COMMENT '是否默认厨房：1-是，0-否。每个用户只有一个默认厨房',
    
    -- 状态字段
    `status` TINYINT UNSIGNED NOT NULL DEFAULT '1' COMMENT '厨房状态：1-正常，0-已删除',
    
    -- 时间戳字段
    `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
    
    -- 主键约束
    PRIMARY KEY (`id`),
    
    -- 普通索引
    KEY `idx_user_id` (`user_id`),
    KEY `idx_is_default` (`is_default`),
    KEY `idx_status` (`status`),
    KEY `idx_created_at` (`created_at`)
    
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='厨房表-存储厨房信息，用于组织菜品和点餐活动';
