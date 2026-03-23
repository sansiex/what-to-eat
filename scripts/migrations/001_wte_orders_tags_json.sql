-- 在订单表上增加标签 JSON 字段（CynosDB / MySQL 执行一次）
-- 若表已按 server/ddl/wte_orders.sql 全量重建且已含 tags，可跳过本脚本

ALTER TABLE `wte_orders`
  ADD COLUMN `tags` JSON NULL COMMENT '用户对这道菜的标签 JSON：[{"categoryKey":"spiciness","tagCode":"mild"},...]' AFTER `dish_id`;
