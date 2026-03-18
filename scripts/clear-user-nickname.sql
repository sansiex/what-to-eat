-- 清空所有用户的昵称
-- 执行前请确认已备份数据

-- 方式1：将昵称重置为 NULL
-- UPDATE wte_users SET nickname = NULL WHERE status = 1;

-- 方式2：将昵称重置为默认值 '微信用户'（推荐，与小程序默认逻辑一致）
UPDATE wte_users SET nickname = '微信用户' WHERE status = 1;

-- 查看更新后的结果
SELECT id, openid, nickname, avatar_url, status, created_at 
FROM wte_users 
WHERE status = 1 
ORDER BY id 
LIMIT 10;
