// pages/meal-list/meal-list.js
const { API } = require('../../utils/cloud-api.js')

Page({
  data: {
    meals: []
  },

  onLoad() {
    this.loadMeals()
  },

  onShow() {
    this.loadMeals()
  },

  onKitchenChange(e) {
    this.loadMeals()
  },

  // 格式化时间为北京时间
  formatBeijingTime(isoString) {
    if (!isoString) return ''
    try {
      const date = new Date(isoString)
      // 转换为北京时间 (UTC+8)
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

  // 加载点餐列表
  async loadMeals() {
    try {
      // 从云函数获取所有点餐数据
      const currentKitchen = getApp().globalData.currentKitchen
      const kitchenId = currentKitchen ? currentKitchen.id : null
      const result = await API.meal.list(null, kitchenId)
      const meals = result.data.list || []

      // 格式化时间和状态
      const mealsWithFormattedTime = meals.map(meal => ({
        ...meal,
        formattedCreatedAt: this.formatBeijingTime(meal.createdAt),
        // 将数字状态转换为字符串状态
        status: meal.status === 1 ? 'ordering' : 'closed',
        // 兼容旧接口：未返回 isCreator 时默认视为自己发起
        isCreator: typeof meal.isCreator === 'boolean' ? meal.isCreator : true
      }))

      // 排序：点餐中排在最前面，每个状态内部按开始时间降序排列
      const sortedMeals = this.sortMeals(mealsWithFormattedTime)

      this.setData({ meals: sortedMeals })

      // 为自己发起的活跃 meal 预生成分享令牌
      this.preGenerateShareTokens(sortedMeals)
    } catch (err) {
      console.error('加载点餐列表失败:', err)
    }
  },

  // 排序餐食列表
  sortMeals(meals) {
    return meals.sort((a, b) => {
      // 按开始时间降序排列（最新的在前），不区分状态
      return new Date(b.createdAt) - new Date(a.createdAt)
    })
  },

  // 编辑点餐
  async editMeal(e) {
    const mealId = e.currentTarget.dataset.id

    try {
      // 获取完整的餐食详情（包含菜品列表）
      const result = await API.meal.get(mealId)
      const meal = result.data

      if (!meal) {
        wx.showToast({ title: '点餐不存在', icon: 'none' })
        return
      }

      // 存储当前编辑的餐食数据到全局
      getApp().globalData.editingMeal = meal

      // 跳转到编辑页面（使用 initiate-meal 页面，传入编辑模式参数）
      wx.navigateTo({
        url: '/pages/initiate-meal/initiate-meal?mode=edit'
      })
    } catch (err) {
      console.error('获取餐食详情失败:', err)
      wx.showToast({ title: '加载失败', icon: 'none' })
    }
  },

  // 收单
  closeMeal(e) {
    const mealId = e.currentTarget.dataset.id

    wx.showModal({
      title: '确认收单',
      content: '收单后将不能再点餐，是否继续？',
      success: async (res) => {
        if (res.confirm) {
          try {
            // 调用云函数收单
            await API.meal.close(mealId)

            // 刷新列表
            this.loadMeals()

            wx.showToast({ title: '收单成功', icon: 'success' })
          } catch (err) {
            console.error('收单失败:', err)
          }
        }
      }
    })
  },

  // 进入点餐页面
  async goOrder(e) {
    const mealId = e.currentTarget.dataset.id
    const meal = this.data.meals.find(m => m.id === mealId)

    if (!meal) {
      wx.showToast({ title: '点餐不存在', icon: 'none' })
      return
    }

    // 检查是否已收单
    if (meal.status === 'closed') {
      wx.showToast({ title: '该点餐已收单', icon: 'none' })
      return
    }

    // 存储当前餐食到全局数据
    getApp().globalData.currentMeal = meal

    // 跳转到点餐页面
    wx.navigateTo({
      url: '/pages/order-food/order-food'
    })
  },

  // 查看点餐详情（只读模式）
  async viewMeal(e) {
    const mealId = e.currentTarget.dataset.id

    try {
      // 获取完整的餐食详情
      const result = await API.meal.get(mealId)
      const meal = result.data

      if (!meal) {
        wx.showToast({ title: '点餐不存在', icon: 'none' })
        return
      }

      // 存储到全局数据
      getApp().globalData.currentMeal = meal
      getApp().globalData.viewMode = true // 标记为查看模式

      // 跳转到点餐页面（查看模式）
      wx.navigateTo({
        url: '/pages/order-food/order-food'
      })
    } catch (err) {
      console.error('获取餐食详情失败:', err)
      wx.showToast({ title: '加载失败', icon: 'none' })
    }
  },

  // 恢复点餐（将已收单的点餐恢复为点餐中状态）
  async reopenMeal(e) {
    const mealId = e.currentTarget.dataset.id

    wx.showModal({
      title: '确认恢复点餐',
      content: '恢复后可以继续点餐，是否继续？',
      success: async (res) => {
        if (res.confirm) {
          try {
            // 调用云函数恢复点餐
            await API.meal.reopen(mealId)
            wx.showToast({ title: '恢复成功', icon: 'success' })
            // 刷新列表
            this.loadMeals()
          } catch (err) {
            console.error('恢复点餐失败:', err)
            wx.showToast({ title: '恢复失败', icon: 'none' })
          }
        }
      }
    })
  },

  // 分享点餐
  async shareMeal(e) {
    const mealId = e.currentTarget.dataset.id
    const meal = this.data.meals.find(m => m.id === mealId)

    if (!meal) {
      wx.showToast({ title: '点餐不存在', icon: 'none' })
      return
    }

    // 检查是否已收单
    if (meal.status === 'closed') {
      wx.showToast({ title: '已收单的点餐不能分享', icon: 'none' })
      return
    }

    try {
      // 调用云函数生成分享链接
      const result = await API.share.generateShareLink(mealId)
      const { shareUrl } = result.data

      // 显示分享菜单
      wx.showActionSheet({
        itemList: ['复制链接', '分享给好友'],
        success: (res) => {
          if (res.tapIndex === 0) {
            // 复制链接
            wx.setClipboardData({
              data: shareUrl,
              success: () => {
                wx.showToast({ title: '链接已复制', icon: 'success' })
              }
            })
          } else if (res.tapIndex === 1) {
            // 调用微信分享
            // 这里可以调用 wx.shareAppMessage
            wx.showToast({ title: '请使用右上角分享按钮', icon: 'none' })
          }
        }
      })
    } catch (err) {
      console.error('生成分享链接失败:', err)
      wx.showToast({ title: '分享失败', icon: 'none' })
    }
  },

  async preGenerateShareTokens(meals) {
    const myActiveMeals = meals.filter(m => m.isCreator && m.status === 'ordering')
    const tokenMap = this.data.shareTokenMap || {}
    for (var i = 0; i < myActiveMeals.length; i++) {
      var meal = myActiveMeals[i]
      if (tokenMap[meal.id]) continue
      try {
        const result = await API.share.generateShareLink(meal.id)
        const token = result && result.data && result.data.shareToken
        if (token) {
          tokenMap[meal.id] = token
        }
      } catch (e) {
        console.warn('预生成分享令牌失败 mealId=' + meal.id, e)
      }
    }
    this.setData({ shareTokenMap: tokenMap })
  },

  onShareAppMessage(e) {
    const mealId = e.target.dataset.id
    const mealName = e.target.dataset.name

    if (!mealId) {
      return {
        title: '今天吃什么？一起来点餐吧！',
        path: '/pages/meal-list/meal-list'
      }
    }

    const tokenMap = this.data.shareTokenMap || {}
    const token = tokenMap[mealId] || ''
    const sharePath = token
      ? `/pages/share-meal/share-meal?token=${token}&mealId=${mealId}`
      : `/pages/share-meal/share-meal?mealId=${mealId}`

    return {
      title: `【${mealName}】快来一起点餐吧！`,
      path: sharePath,
      imageUrl: '/images/share_card.jpg'
    }
  }
})
