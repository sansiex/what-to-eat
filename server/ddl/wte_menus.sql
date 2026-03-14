-- ======================================================== 
-- 菜单表 (wte_menus)
-- 存储菜单信息，每个菜单包含多个菜品
-- 菜单属于厨房，通过厨房ID关联
-- ========================================================

CREATE TABLE IF NOT EXISTS `wte_menus` (
    -- 主键ID，自增
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '菜单ID，主键',
    
    -- 关联字段
    `kitchen_id` BIGINT UNSIGNED NOT NULL COMMENT '所属厨房ID，关联wte_kitchens.id',
    `user_id` BIGINT UNSIGNED NOT NULL COMMENT '创建者用户ID，关联wte_users.id',
    
    -- 菜单信息字段
    `name` VARCHAR(100) NOT NULL COMMENT '菜单名称，如：午餐、晚餐、聚会',
    
    -- 状态字段
    `status` TINYINT UNSIGNED NOT NULL DEFAULT '1' COMMENT '菜单状态：1-正常，0-已删除',
    
    -- 时间戳字段
    `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
    
    -- 主键约束
    PRIMARY KEY (`id`),
    
    -- 普通索引
    KEY `idx_kitchen_id` (`kitchen_id`),
    KEY `idx_user_id` (`user_id`),
    KEY `idx_status` (`status`),
    KEY `idx_created_at` (`created_at`)
    
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='菜单表-存储厨房自定义菜单';

-- 添加厨房ID字段到现有表（如果表已存在）
ALTER TABLE `wte_menus` 
ADD COLUMN IF NOT EXISTS `kitchen_id` BIGINT UNSIGNED NOT NULL DEFAULT '1' COMMENT '所属厨房ID，关联wte_kitchens.id' AFTER `id`,
ADD INDEX IF NOT EXISTS `idx_kitchen_id` (`kitchen_id`);
