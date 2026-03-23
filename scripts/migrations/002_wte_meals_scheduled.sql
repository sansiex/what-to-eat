-- 计划用餐时间（北京时间）：日期必选由前端默认；时间可选，5 分钟粒度
ALTER TABLE `wte_meals`
  ADD COLUMN `scheduled_at` DATETIME NULL DEFAULT NULL COMMENT '计划用餐日期时间（北京时间）' AFTER `name`,
  ADD COLUMN `scheduled_time_specified` TINYINT UNSIGNED NOT NULL DEFAULT 0 COMMENT '是否指定了具体时刻（1=是，0=仅日期）' AFTER `scheduled_at`;
