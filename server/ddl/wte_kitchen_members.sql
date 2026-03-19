-- ========================================================
-- 厨房成员表 (wte_kitchen_members)
-- 存储厨房的成员信息，支持厨房主人和管理员角色
-- ========================================================

CREATE TABLE IF NOT EXISTS `wte_kitchen_members` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '成员记录ID，主键',
    `kitchen_id` BIGINT UNSIGNED NOT NULL COMMENT '厨房ID，关联wte_kitchens.id',
    `user_id` BIGINT UNSIGNED NOT NULL COMMENT '用户ID，关联wte_users.id',
    `role` VARCHAR(20) NOT NULL DEFAULT 'admin' COMMENT '角色：owner-厨房主人，admin-管理员',
    `status` TINYINT UNSIGNED NOT NULL DEFAULT '1' COMMENT '状态：1-正常，0-已移除',
    `invited_by` BIGINT UNSIGNED DEFAULT NULL COMMENT '邀请人用户ID',
    `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',

    PRIMARY KEY (`id`),
    UNIQUE KEY `uk_kitchen_user` (`kitchen_id`, `user_id`),
    KEY `idx_user_id` (`user_id`),
    KEY `idx_kitchen_id` (`kitchen_id`),
    KEY `idx_status` (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='厨房成员表-存储厨房主人和管理员关系';

-- 数据迁移：为所有现有厨房创建 owner 记录
INSERT IGNORE INTO wte_kitchen_members (kitchen_id, user_id, role, status)
SELECT id, user_id, 'owner', 1 FROM wte_kitchens WHERE status = 1;
