-- 点餐分享表
-- 用于存储用户生成的分享链接

CREATE TABLE IF NOT EXISTS wte_meal_shares (
    id INT AUTO_INCREMENT PRIMARY KEY COMMENT '分享ID',
    meal_id INT NOT NULL COMMENT '关联的点餐ID',
    share_token VARCHAR(255) NOT NULL COMMENT '分享令牌（唯一标识）',
    created_by INT NOT NULL COMMENT '创建分享的用户ID',
    status TINYINT DEFAULT 1 COMMENT '状态：1-有效，0-失效',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
    
    -- 索引
    INDEX idx_meal_id (meal_id),
    INDEX idx_share_token (share_token),
    INDEX idx_created_by (created_by),
    INDEX idx_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='点餐分享表';
