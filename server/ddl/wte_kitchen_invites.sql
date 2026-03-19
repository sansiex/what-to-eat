-- ========================================================
-- 厨房邀请表 (wte_kitchen_invites)
-- 存储厨房邀请令牌，支持通过分享链接邀请管理员
-- ========================================================

CREATE TABLE IF NOT EXISTS `wte_kitchen_invites` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '邀请记录ID，主键',
    `kitchen_id` BIGINT UNSIGNED NOT NULL COMMENT '厨房ID，关联wte_kitchens.id',
    `user_id` BIGINT UNSIGNED NOT NULL COMMENT '邀请人用户ID（厨房主人）',
    `token` VARCHAR(64) NOT NULL COMMENT '邀请令牌',
    `expires_at` TIMESTAMP NOT NULL COMMENT '过期时间',
    `status` TINYINT UNSIGNED NOT NULL DEFAULT '1' COMMENT '状态：1-有效，0-已撤销',
    `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',

    PRIMARY KEY (`id`),
    UNIQUE KEY `uk_token` (`token`),
    KEY `idx_kitchen_id` (`kitchen_id`),
    KEY `idx_expires_at` (`expires_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='厨房邀请表-存储管理员邀请令牌';
