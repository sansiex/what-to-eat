-- ========================================================
-- 点餐表 (wte_meals)
-- 存储点餐活动信息，每个点餐活动对应一条记录
-- 包含点餐名称、状态、创建者、所属厨房等信息
-- ========================================================

CREATE TABLE IF NOT EXISTS `wte_meals` (
    -- 主键ID，自增
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '点餐ID，主键',
    
    -- 关联字段
    `user_id` BIGINT UNSIGNED NOT NULL COMMENT '创建者用户ID，关联wte_users.id',
    `kitchen_id` BIGINT UNSIGNED NOT NULL COMMENT '所属厨房ID，关联wte_kitchens.id',
    
    -- 点餐信息字段
    `name` VARCHAR(100) NOT NULL COMMENT '点餐名称，如：午餐、晚餐、自定义名称',
    `scheduled_at` DATETIME NULL DEFAULT NULL COMMENT '计划用餐日期时间（北京时间）',
    `scheduled_time_specified` TINYINT UNSIGNED NOT NULL DEFAULT 0 COMMENT '是否指定具体时刻：1-是，0-仅日期（scheduled_at 为当日 00:00:00）',
    `status` TINYINT UNSIGNED NOT NULL DEFAULT '1' COMMENT '点餐状态：1-点餐中，2-已收单',
    `participant_user_ids` JSON NULL COMMENT '参与点餐用户ID JSON 数组（不含厨房主人/管理员，去重后计 15 人上限）',
    
    -- 时间戳字段
    `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
    `closed_at` TIMESTAMP NULL DEFAULT NULL COMMENT '收单时间，status=2时填充',
    
    -- 主键约束
    PRIMARY KEY (`id`),
    
    -- 普通索引
    KEY `idx_user_id` (`user_id`),
    KEY `idx_kitchen_id` (`kitchen_id`),
    KEY `idx_status` (`status`),
    KEY `idx_created_at` (`created_at`),
    KEY `idx_closed_at` (`closed_at`)
    
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='点餐表-存储点餐活动信息';
