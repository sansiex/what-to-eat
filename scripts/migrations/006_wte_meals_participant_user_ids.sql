-- 参与点餐用户列表（不含厨房主人/管理员），用于 15 人上限；执行前请备份。

ALTER TABLE `wte_meals`
  ADD COLUMN `participant_user_ids` JSON NULL COMMENT '参与点餐用户ID JSON 数组' AFTER `status`;

-- 若曾给 wte_meal_shares 加过 visitor_user_ids（旧方案），可删除该列以免混淆：
-- ALTER TABLE `wte_meal_shares` DROP COLUMN `visitor_user_ids`;
