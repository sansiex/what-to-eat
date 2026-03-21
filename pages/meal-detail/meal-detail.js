// pages/meal-detail/meal-detail.js
const { API } = require('../../utils/cloud-api.js')

Page({
  data: {
    mealId: null,
    meal: null,
    orderedDishes: [],
    unorderedDishes: [],
    /** 未点菜品区块是否展开（默认折叠） */
    unorderedSectionExpanded: false,
    canManage: false,
    shareToken: ''
  },

  onLoad(options) {
    const mealId = parseInt(options.mealId)
    if (!mealId) {
      wx.showToast({ title: '参数错误', icon: 'none' })
      return
    }
    this.setData({ mealId })
    this.loadMealDetail()
  },

  onShow() {
    if (this.data.mealId) {
      this.loadMealDetail()
    }
  },

  toggleUnorderedSection() {
    this.setData({
      unorderedSectionExpanded: !this.data.unorderedSectionExpanded
    })
  },

  formatBeijingTime(isoString) {
    if (!isoString) return ''
    try {
      const date = new Date(isoString)
      const beijingTime = new Date(date.getTime() + 8 * 60 * 60 * 1000)
      const year = beijingTime.getUTCFullYear()
      const month = String(beijingTime.getUTCMonth() + 1).padStart(2, '0')
      const day = String(beijingTime.getUTCDate()).padStart(2, '0')
      const hours = String(beijingTime.getUTCHours()).padStart(2, '0')
      const minutes = String(beijingTime.getUTCMinutes()).padStart(2, '0')
      return `${year}-${month}-${day} ${hours}:${minutes}`
    } catch (e) {
      return ''
    }
  },

  async loadMealDetail() {
    const { mealId } = this.data
    try {
      const result = await API.meal.get(mealId)
      const meal = result.data
      if (!meal) {
        wx.showToast({ title: '点餐不存在', icon: 'none' })
        return
      }

      const defaultImg = '/images/dish-placeholder.png'
      const orderedDishes = (meal.dishes || [])
        .filter(d => (d.orderers || []).length > 0)
        .map(d => ({
          ...d,
          displayImage: (d.imageUrl || d.image_url) || defaultImg,
          ordererText: (d.orderers || []).length > 0 ? '已点：' + (d.orderers || []).join('、') : '暂无点选'
        }))
      const unorderedDishes = (meal.dishes || [])
        .filter(d => !(d.orderers || []).length)
        .map(d => ({
          ...d,
          displayImage: (d.imageUrl || d.image_url) || defaultImg
        }))

      const canManage = meal.isCreator || (meal.kitchenRole === 'owner' || meal.kitchenRole === 'admin')

      this.setData({
        meal: {
          ...meal,
          formattedCreatedAt: this.formatBeijingTime(meal.createdAt),
          statusText: meal.status === 1 ? '点餐中' : '已收单'
        },
        orderedDishes,
        unorderedDishes,
        canManage
      })

      if (canManage && meal.status === 1) {
        this.preGenerateShareToken(mealId)
      }
    } catch (err) {
      console.error('加载点餐详情失败:', err)
      wx.showToast({ title: '加载失败', icon: 'none' })
    }
  },

  async preGenerateShareToken(mealId) {
    try {
      const result = await API.share.generateShareLink(mealId)
      const token = result && result.data && result.data.shareToken
      if (token) this.setData({ shareToken: token })
    } catch (e) {
      console.warn('预生成分享令牌失败:', e)
    }
  },

  // 修改（编辑）
  async editMeal() {
    const meal = this.data.meal
    if (!meal) return
    if (meal.status !== 1) {
      wx.showToast({ title: '已收单的点餐不能修改', icon: 'none' })
      return
    }
    if (!this.data.canManage) {
      wx.showToast({ title: '无权限修改', icon: 'none' })
      return
    }
    getApp().globalData.editingMeal = meal
    wx.navigateTo({
      url: '/pages/initiate-meal/initiate-meal?mode=edit'
    })
  },

  // 点餐（点餐中可下单，已收单为查看模式）
  goOrder() {
    const meal = this.data.meal
    if (!meal) return
    getApp().globalData.currentMeal = meal
    getApp().globalData.viewMode = meal.status !== 1
    wx.navigateTo({
      url: '/pages/order-food/order-food'
    })
  },

  tapCloseOrReopen() {
    if (this.data.meal.status === 1) {
      this.closeMeal()
    } else {
      this.reopenMeal()
    }
  },

  // 删除点餐（需为厨房成员，与云函数权限一致）
  deleteMeal() {
    const meal = this.data.meal
    if (!meal || !meal.isKitchenMember) {
      wx.showToast({ title: '无权限删除', icon: 'none' })
      return
    }
    wx.showModal({
      title: '确认删除',
      content: `确定删除「${meal.name}」吗？删除后无法恢复。`,
      confirmColor: '#E53935',
      success: async (res) => {
        if (!res.confirm) return
        try {
          wx.showLoading({ title: '删除中...' })
          await API.meal.delete(meal.id)
          wx.hideLoading()
          wx.showToast({ title: '已删除', icon: 'success' })
          setTimeout(() => wx.navigateBack(), 400)
        } catch (err) {
          wx.hideLoading()
          console.error('删除点餐失败:', err)
          wx.showToast({ title: '删除失败', icon: 'none' })
        }
      }
    })
  },

  // 收单
  closeMeal() {
    const meal = this.data.meal
    if (!meal) return
    if (meal.status !== 1) {
      wx.showToast({ title: '该点餐已收单', icon: 'none' })
      return
    }
    if (!this.data.canManage) {
      wx.showToast({ title: '无权限收单', icon: 'none' })
      return
    }
    wx.showModal({
      title: '确认收单',
      content: '收单后将不能再点餐，是否继续？',
      success: async (res) => {
        if (res.confirm) {
          try {
            await API.meal.close(meal.id)
            wx.showToast({ title: '收单成功', icon: 'success' })
            this.loadMealDetail()
          } catch (err) {
            console.error('收单失败:', err)
            wx.showToast({ title: '收单失败', icon: 'none' })
          }
        }
      }
    })
  },

  // 恢复点餐
  reopenMeal() {
    const meal = this.data.meal
    if (!meal) return
    if (meal.status === 1) return
    if (!this.data.canManage) {
      wx.showToast({ title: '无权限恢复', icon: 'none' })
      return
    }
    wx.showModal({
      title: '确认恢复点餐',
      content: '恢复后可以继续点餐，是否继续？',
      success: async (res) => {
        if (res.confirm) {
          try {
            await API.meal.reopen(meal.id)
            wx.showToast({ title: '恢复成功', icon: 'success' })
            this.loadMealDetail()
          } catch (err) {
            console.error('恢复点餐失败:', err)
            wx.showToast({ title: '恢复失败', icon: 'none' })
          }
        }
      }
    })
  },

  onShareAppMessage() {
    const meal = this.data.meal
    const token = this.data.shareToken || ''
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
