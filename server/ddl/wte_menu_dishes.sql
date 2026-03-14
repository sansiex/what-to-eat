-- ======================================================== 
-- 菜单菜品关联表 (wte_menu_dishes)
-- 存储菜单与菜品的关联关系，多对多关系
-- 记录每个菜单包含哪些菜品
-- ========================================================

CREATE TABLE IF NOT EXISTS `wte_menu_dishes` (
    -- 主键ID，自增
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '关联ID，主键',
    
    -- 关联字段
    `menu_id` BIGINT UNSIGNED NOT NULL COMMENT '菜单ID，关联wte_menus.id',
    `dish_id` BIGINT UNSIGNED NOT NULL COMMENT '菜品ID，关联wte_dishes.id',
    
    -- 状态字段
    `status` TINYINT UNSIGNED NOT NULL DEFAULT '1' COMMENT '状态：1-正常，0-已删除',
    
    -- 时间戳字段
    `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
    
    -- 主键约束
    PRIMARY KEY (`id`),
    
    -- 唯一索引：一个菜单中不能重复添加同一菜品
    UNIQUE KEY `uk_menu_dish` (`menu_id`, `dish_id`),
    
    -- 普通索引
    KEY `idx_menu_id` (`menu_id`),
    KEY `idx_dish_id` (`dish_id`),
    KEY `idx_status` (`status`)
    
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='菜单菜品关联表-存储菜单与菜品的关联关系';
