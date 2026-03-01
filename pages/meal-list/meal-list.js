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
      const result = await API.meal.list()
      const meals = result.data.list || []

      // 格式化时间和状态
      const mealsWithFormattedTime = meals.map(meal => ({
        ...meal,
        formattedCreatedAt: this.formatBeijingTime(meal.createdAt),
        // 将数字状态转换为字符串状态
        status: meal.status === 1 ? 'ordering' : 'closed'
      }))

      // 排序：点餐中排在最前面，每个状态内部按开始时间降序排列
      const sortedMeals = this.sortMeals(mealsWithFormattedTime)

      this.setData({ meals: sortedMeals })
    } catch (err) {
      console.error('加载点餐列表失败:', err)
    }
  },

  // 排序餐食列表
  sortMeals(meals) {
    return meals.sort((a, b) => {
      // 点餐中状态排在最前面
      if (a.status === 'ordering' && b.status !== 'ordering') {
        return -1
      }
      if (a.status !== 'ordering' && b.status === 'ordering') {
        return 1
      }
      // 相同状态下按开始时间降序排列（最新的在前）
      return new Date(b.createdAt) - new Date(a.createdAt)
    })
  },

  // 编辑点餐
  async editMeal(e) {
    const mealId = e.currentTarget.dataset.id
    const meal = this.data.meals.find(m => m.id === mealId)

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
    wx.switchTab({
      url: '/pages/order-food/order-food'
    })
  }
})
