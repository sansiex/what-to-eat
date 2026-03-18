-- 查看所有用户的昵称情况
SELECT id, openid, nickname, avatar_url, status, created_at 
FROM wte_users 
ORDER BY id 
LIMIT 20;

-- 统计使用默认昵称的用户数量
SELECT COUNT(*) as default_nickname_count 
FROM wte_users 
WHERE nickname = '微信用户' OR nickname IS NULL;
