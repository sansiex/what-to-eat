-- ========================================================
-- 点餐菜品关联表 (wte_meal_dishes)
-- 存储点餐活动与菜品的关联关系，多对多关系
-- 记录每个点餐活动包含哪些菜品
-- ========================================================

CREATE TABLE IF NOT EXISTS `wte_meal_dishes` (
    -- 主键ID，自增
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '关联ID，主键',
    
    -- 关联字段
    `meal_id` BIGINT UNSIGNED NOT NULL COMMENT '点餐ID，关联wte_meals.id',
    `dish_id` BIGINT UNSIGNED NOT NULL COMMENT '菜品ID，关联wte_dishes.id',
    
    -- 状态字段
    `status` TINYINT UNSIGNED NOT NULL DEFAULT '1' COMMENT '状态：1-正常，0-已删除',
    
    -- 时间戳字段
    `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
    
    -- 主键约束
    PRIMARY KEY (`id`),
    
    -- 唯一索引：一个点餐活动中不能重复添加同一菜品
    UNIQUE KEY `uk_meal_dish` (`meal_id`, `dish_id`),
    
    -- 普通索引
    KEY `idx_meal_id` (`meal_id`),
    KEY `idx_dish_id` (`dish_id`),
    KEY `idx_status` (`status`)
    
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='点餐菜品关联表-存储点餐与菜品的关联关系';
