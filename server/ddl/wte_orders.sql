-- ========================================================
-- 订单表 (wte_orders)
-- 存储用户下单信息，记录哪个用户点了哪个点餐活动中的哪些菜品
-- 支持一个订单包含多个菜品
-- ========================================================

CREATE TABLE IF NOT EXISTS `wte_orders` (
    -- 主键ID，自增
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '订单ID，主键',
    
    -- 关联字段
    `meal_id` BIGINT UNSIGNED NOT NULL COMMENT '点餐ID，关联wte_meals.id',
    `user_id` BIGINT UNSIGNED NOT NULL COMMENT '下单用户ID，关联wte_users.id',
    `dish_id` BIGINT UNSIGNED NOT NULL COMMENT '菜品ID，关联wte_dishes.id',
    
    -- 状态字段
    `status` TINYINT UNSIGNED NOT NULL DEFAULT '1' COMMENT '订单状态：1-正常，0-已取消',
    
    -- 时间戳字段
    `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '下单时间',
    `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
    `canceled_at` TIMESTAMP NULL DEFAULT NULL COMMENT '取消时间，status=0时填充',
    
    -- 主键约束
    PRIMARY KEY (`id`),
    
    -- 普通索引
    KEY `idx_meal_id` (`meal_id`),
    KEY `idx_user_id` (`user_id`),
    KEY `idx_dish_id` (`dish_id`),
    KEY `idx_status` (`status`),
    KEY `idx_created_at` (`created_at`),
    
    -- 复合索引：查询某个点餐活动中某用户的所有订单
    KEY `idx_meal_user` (`meal_id`, `user_id`)
    
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='订单表-存储用户下单信息';
