-- ======================================================== 
-- 菜品表 (wte_dishes)
-- 存储菜品信息，每个菜品对应一条记录
-- 支持按用户和厨房隔离，每个厨房有自己的菜品库
-- ========================================================

CREATE TABLE IF NOT EXISTS `wte_dishes` (
    -- 主键ID，自增
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '菜品ID，主键',
    
    -- 关联字段
    `user_id` BIGINT UNSIGNED NOT NULL COMMENT '创建者用户ID，关联wte_users.id',
    `kitchen_id` BIGINT UNSIGNED NOT NULL COMMENT '所属厨房ID，关联wte_kitchens.id',
    
    -- 菜品信息字段
    `name` VARCHAR(200) NOT NULL COMMENT '菜品名称',
    `description` TEXT DEFAULT NULL COMMENT '菜品描述/备注',
    
    -- 状态字段
    `status` TINYINT UNSIGNED NOT NULL DEFAULT '1' COMMENT '菜品状态：1-正常，0-已删除',
    
    -- 时间戳字段
    `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
    
    -- 主键约束
    PRIMARY KEY (`id`),
    
    -- 普通索引
    KEY `idx_user_id` (`user_id`),
    KEY `idx_kitchen_id` (`kitchen_id`),
    KEY `idx_status` (`status`),
    KEY `idx_created_at` (`created_at`)
    
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='菜品表-存储用户菜品信息';
