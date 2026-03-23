-- 存量数据：用餐时间（scheduled_at）为空的点餐，补全为「与发起日同一天、仅日期、不指定时刻」
-- 约定：scheduled_time_specified = 0 时 scheduled_at 为该北京日历日的 00:00:00（与业务代码一致）
--
-- 执行前建议先预览：
--   SELECT id, name, created_at, scheduled_at, scheduled_time_specified
--   FROM wte_meals
--   WHERE scheduled_at IS NULL;
--
-- 说明：
-- - 优先在「会话时区为北京时间」的客户端执行（如 mysql 会话 time_zone = '+08:00' 或 Asia/Shanghai），
--   此时 DATE(created_at) 即为发起时间的北京日历日。
-- - 若会话时区不是东八区，请改用下方注释中的「显式按 UTC→+8 取日」版本。

UPDATE wte_meals
SET
  scheduled_at = CONCAT(DATE(created_at), ' 00:00:00'),
  scheduled_time_specified = 0
WHERE scheduled_at IS NULL;

-- 可选：会话非 +8 时，用 UTC 转东八区再取日期（需 MySQL 支持 CONVERT_TZ 与偏移写法）
-- UPDATE wte_meals
-- SET
--   scheduled_at = CONCAT(DATE(CONVERT_TZ(created_at, '+00:00', '+08:00')), ' 00:00:00'),
--   scheduled_time_specified = 0
-- WHERE scheduled_at IS NULL;
