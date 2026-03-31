/**
 * 参与/邀请上限时：退出小程序或进入当前用户默认厨房（无则创建）
 */
const { API } = require('./cloud-api.js')

const MEAL_LIMIT_MSG = '参与点餐人数已达上限，无法加入更多人点餐。'
const ADMIN_LIMIT_MSG =
  '您要加入的厨房管理员数量已达到上限，无法继续增加管理员。您可以进入自己的厨房。'

function showExitOrEnterKitchenModal(content) {
  wx.showModal({
    content: content || MEAL_LIMIT_MSG,
    confirmText: '进入我自己的厨房',
    cancelText: '退出',
    success(res) {
      if (res.confirm) {
        enterMyKitchenTab()
      } else if (res.cancel) {
        wx.exitMiniProgram({})
      }
    }
  })
}

async function enterMyKitchenTab() {
  try {
    await API.kitchen.getOrCreateDefault()
    wx.switchTab({ url: '/pages/kitchen-manage/kitchen-manage' })
  } catch (e) {
    console.error('enterMyKitchenTab:', e)
    wx.showToast({ title: '进入失败', icon: 'none' })
  }
}

module.exports = {
  showExitOrEnterKitchenModal,
  enterMyKitchenTab,
  MEAL_LIMIT_MSG,
  ADMIN_LIMIT_MSG
}
