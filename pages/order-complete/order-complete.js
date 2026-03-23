// pages/order-complete/order-complete.js
const { API } = require('../../utils/cloud-api.js')
const { previewSingleDishImage } = require('../../utils/dish-preview.js')
const { formatTagView } = require('../../utils/dish-tag-view.js')

Page({
  data: {
    meal: null,
    orderedDishes: [],
    unorderedDishes: [],
    isCreator: false,
    shareToken: '',
    expandedDishId: null
  },

  onLoad() {
    const data = getApp().globalData.orderCompleteData
    if (!data) {
      wx.showToast({ title: '数据异常', icon: 'none' })
      return
    }

    const { meal, allDishes, orderedDishIds, isCreator, shareToken } = data

    const orderedSet = new Set(orderedDishIds)
    const mapDish = d => ({
      ...d,
      displayImage: d.displayImage || d.imageUrl || '/images/dish-placeholder.png',
      displayDescription: d.displayDescription || d.description || '暂无描述',
      tagView: formatTagView(d.tagDisplay)
    })
    const orderedDishes = allDishes.filter(d => orderedSet.has(d.id)).map(mapDish)
    const unorderedDishes = allDishes.filter(d => !orderedSet.has(d.id)).map(mapDish)

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

    this.hydrateTagsFromServer(meal.id)
  },

  noop() {},

  toggleDishExpand(e) {
    const id = e.currentTarget.dataset.id
    if (id == null) return
    this.setData({
      expandedDishId: this.data.expandedDishId === id ? null : id
    })
  },

  async hydrateTagsFromServer(mealId) {
    if (!mealId) return
    try {
      const res = await API.meal.get(mealId)
      const dishMap = new Map((res.data.dishes || []).map(d => [d.id, d]))
      const patch = list =>
        list.map(d => {
          const fresh = dishMap.get(d.id)
          const tagDisplay = fresh && fresh.tagDisplay != null ? fresh.tagDisplay : d.tagDisplay
          return { ...d, tagView: formatTagView(tagDisplay) }
        })
      this.setData({
        orderedDishes: patch(this.data.orderedDishes),
        unorderedDishes: patch(this.data.unorderedDishes)
      })
    } catch (e) {
      console.warn('hydrateTagsFromServer', e)
    }
  },

  previewDishImage(e) {
    previewSingleDishImage(e.currentTarget.dataset.url)
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

  goMealList() {
    wx.switchTab({
      url: '/pages/meal-list/meal-list'
    })
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
