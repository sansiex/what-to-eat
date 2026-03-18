-- 查看所有用户及其昵称
SELECT id, openid, nickname, avatar_url, status, created_at 
FROM wte_users 
ORDER BY id;

-- 查看订单和对应的用户信息
SELECT 
  o.id as order_id,
  o.meal_id,
  o.user_id,
  u.nickname,
  u.openid,
  o.status,
  o.created_at
FROM wte_orders o
LEFT JOIN wte_users u ON o.user_id = u.id
WHERE o.status = 1
ORDER BY o.created_at DESC
LIMIT 20;
