// pages/order-complete/order-complete.js
const { API } = require('../../utils/cloud-api.js')

Page({
  data: {
    meal: null,
    orderedDishes: [],
    unorderedDishes: [],
    isCreator: false,
    shareToken: ''
  },

  onLoad() {
    const data = getApp().globalData.orderCompleteData
    if (!data) {
      wx.showToast({ title: '数据异常', icon: 'none' })
      return
    }

    const { meal, allDishes, orderedDishIds, isCreator, shareToken } = data

    const orderedSet = new Set(orderedDishIds)
    const orderedDishes = allDishes.filter(d => orderedSet.has(d.id))
    const unorderedDishes = allDishes.filter(d => !orderedSet.has(d.id))

    this.setData({
      meal,
      orderedDishes,
      unorderedDishes,
      isCreator: !!isCreator,
      shareToken: shareToken || ''
    })

    if (isCreator && !shareToken) {
      this.preGenerateShareToken(meal.id)
    }
  },

  previewDishImage(e) {
    var url = e.currentTarget.dataset.url
    if (!url) return
    wx.previewImage({ current: url, urls: [url] })
  },

  async preGenerateShareToken(mealId) {
    try {
      const result = await API.share.generateShareLink(mealId)
      const token = result && result.data && result.data.shareToken
      if (token) {
        this.setData({ shareToken: token })
      }
    } catch (e) {
      console.warn('预生成分享令牌失败:', e)
    }
  },

  reOrder() {
    wx.navigateBack()
  },

  enterMyKitchen() {
    wx.switchTab({
      url: '/pages/menu-list/menu-list'
    })
  },

  onShareAppMessage() {
    const { meal, shareToken } = this.data
    if (!meal) {
      return { title: '今天吃什么？', path: '/pages/meal-list/meal-list' }
    }

    const token = shareToken || ''
    const sharePath = token
      ? `/pages/share-meal/share-meal?token=${token}&mealId=${meal.id}`
      : `/pages/share-meal/share-meal?mealId=${meal.id}`

    return {
      title: `【${meal.name}】快来一起点餐吧！`,
      path: sharePath,
      imageUrl: '/images/share_card.jpg'
    }
  }
})
