/**
 * 有人下单后向点餐发起者发送订阅消息（需在公众平台配置模板并与 env 一致）
 */

const cloud = require('wx-server-sdk');
const { truncateThing } = require('./subscribe-notify-truncate');

/**
 * @param {import('mysql2/promise').Pool} queryFn - order 云函数 utils/db 的 query
 */
async function notifyMealCreatorOnNewOrder(queryFn, mealId, ordererUserId, ordererLabelFallback) {
  const tmpl = process.env.WTE_SUBSCRIBE_TMPL_ORDER
  if (!tmpl || !String(tmpl).trim()) {
    return
  }

  const rows = await queryFn(
    `SELECT m.id, m.name AS meal_name, m.user_id AS creator_id,
            uc.openid AS creator_openid,
            uo.nickname AS orderer_nick
     FROM wte_meals m
     INNER JOIN wte_users uc ON m.user_id = uc.id
     LEFT JOIN wte_users uo ON uo.id = ?
     WHERE m.id = ?`,
    [ordererUserId, mealId]
  )

  if (!rows || rows.length === 0) return
  const row = rows[0]

  if (Number(row.creator_id) === Number(ordererUserId)) {
    return
  }

  const openid = row.creator_openid
  if (!openid || String(openid).startsWith('anonymous_')) {
    return
  }

  const ordererName =
    (row.orderer_nick && String(row.orderer_nick).trim()) ||
    (ordererLabelFallback && String(ordererLabelFallback).trim()) ||
    '用户'
  const mealName = (row.meal_name && String(row.meal_name).trim()) || '点餐'

  const miniprogramState =
    process.env.WTE_MINIPROGRAM_STATE === 'developer' ? 'developer' : 'formal'

  try {
    const res = await cloud.openapi.subscribeMessage.send({
      touser: openid,
      templateId: String(tmpl).trim(),
      page: `pages/meal-detail/meal-detail?mealId=${mealId}`,
      lang: 'zh_CN',
      miniprogramState,
      data: {
        thing1: { value: truncateThing(ordererName, 20) },
        thing2: { value: truncateThing(mealName, 20) },
        thing3: { value: '已下单，点卡片查看详情' }
      }
    })
    console.log('subscribeMessage.send meal order notify:', res)
  } catch (e) {
    console.warn('subscribeMessage.send failed:', e && e.message, e)
  }
}

module.exports = {
  notifyMealCreatorOnNewOrder
}
