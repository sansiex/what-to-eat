/**
 * 发起者订阅「有人在我发起的点餐下单」通知（一次性订阅，每次授权可发一条）
 */
const { MEAL_ORDER_NOTIFY_TMPL_ID } = require('./subscribe-config.js')

function requestMealOrderNotifySubscribe() {
  const id = (MEAL_ORDER_NOTIFY_TMPL_ID || '').trim()
  if (!id) {
    return Promise.resolve()
  }
  return new Promise((resolve) => {
    wx.requestSubscribeMessage({
      tmplIds: [id],
      complete: () => resolve()
    })
  })
}

module.exports = {
  requestMealOrderNotifySubscribe
}
