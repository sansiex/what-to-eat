/**
 * 订阅消息模板 ID（与云函数 order 环境变量 WTE_SUBSCRIBE_TMPL_ORDER 保持一致）
 * 在微信公众平台 → 功能 → 订阅消息 中新增模板，需包含 3 个「thing」类型字段：
 *   thing1：下单人（≤20 字） thing2：点餐名称（≤20 字） thing3：说明（如「已下单，点卡片查看详情」）
 * 未配置则不会弹授权、服务端也不会发送（静默跳过）
 */
module.exports = {
  MEAL_ORDER_NOTIFY_TMPL_ID: ''
}
