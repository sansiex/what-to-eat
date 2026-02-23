// pages/meal-list/meal-list.js
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
  loadMeals() {
    // 从本地存储获取所有餐食数据
    const meals = wx.getStorageSync('meals') || []
    
    // 格式化时间
    const mealsWithFormattedTime = meals.map(meal => ({
      ...meal,
      formattedCreatedAt: this.formatBeijingTime(meal.createdAt)
    }))
    
    // 排序：点餐中排在最前面，每个状态内部按开始时间降序排列
    const sortedMeals = this.sortMeals(mealsWithFormattedTime)
    
    this.setData({ meals: sortedMeals })
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
  editMeal(e) {
    const mealId = e.currentTarget.dataset.id
    const meal = this.data.meals.find(m => m.id === mealId)
    
    if (!meal) {
      wx.showToast({ title: '点餐不存在', icon: 'none' })
      return
    }

    // 存储当前编辑的餐食数据
    wx.setStorageSync('editingMeal', meal)
    
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
      success: (res) => {
        if (res.confirm) {
          // 获取所有餐食
          let meals = wx.getStorageSync('meals') || []
          
          // 找到对应餐食并修改状态
          const mealIndex = meals.findIndex(m => m.id === mealId)
          if (mealIndex !== -1) {
            meals[mealIndex].status = 'closed'
            
            // 保存到本地存储
            wx.setStorageSync('meals', meals)
            
            // 刷新列表
            this.loadMeals()
            
            wx.showToast({ title: '收单成功', icon: 'success' })
          }
        }
      }
    })
  },

  // 进入点餐页面
  goOrder(e) {
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

    // 存储当前餐食到本地存储
    wx.setStorageSync('currentMeal', meal)
    
    // 跳转到点餐页面
    wx.switchTab({
      url: '/pages/order-food/order-food'
    })
  }
})