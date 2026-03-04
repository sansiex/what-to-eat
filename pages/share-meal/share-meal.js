// pages/share-meal/share-meal.js
const { API } = require('../../utils/cloud-api.js')

Page({
  data: {
    meal: null,
    dishes: [],
    selectedDishes: [],
    dishSelectionMap: {},
    shareToken: '',
    mealId: '',
    userName: '',
    hasOrdered: false,
    showNameInput: false,
    showEnterKitchenButton: false
  },

  onLoad(options) {
    // 获取分享参数
    const { token, mealId } = options
    
    if (!token || !mealId) {
      wx.showToast({
        title: '分享链接无效',
        icon: 'none'
      })
      return
    }

    this.setData({
      shareToken: token,
      mealId: parseInt(mealId)
    })

    // 加载分享的点餐详情
    this.loadSharedMeal()
  },

  // 加载分享的点餐详情
  async loadSharedMeal() {
    try {
      const result = await API.share.getByShareToken(
        this.data.shareToken,
        this.data.mealId
      )

      const meal = result.data
      
      // 默认选中所有菜品
      const selectedDishes = meal.dishes.map(d => d.id)
      const dishSelectionMap = {}
      meal.dishes.forEach(dish => {
        dishSelectionMap[dish.id] = true
      })

      this.setData({
        meal,
        dishes: meal.dishes,
        selectedDishes,
        dishSelectionMap
      })
    } catch (err) {
      console.error('加载分享点餐失败:', err)
      wx.showToast({
        title: '分享链接已失效',
        icon: 'none'
      })
    }
  },

  // 复选框变化
  onCheckboxChange(e) {
    const selectedIds = e.detail.value.map(id => parseInt(id))
    const dishSelectionMap = {}
    
    this.data.dishes.forEach(dish => {
      dishSelectionMap[dish.id] = selectedIds.includes(dish.id)
    })

    this.setData({
      selectedDishes: selectedIds,
      dishSelectionMap
    })
  },

  // 显示姓名输入框
  showNameInput() {
    if (this.data.selectedDishes.length === 0) {
      wx.showToast({
        title: '请至少选择一个菜品',
        icon: 'none'
      })
      return
    }

    this.setData({
      showNameInput: true
    })
  },

  // 隐藏姓名输入框
  hideNameInput() {
    this.setData({
      showNameInput: false
    })
  },

  // 姓名输入
  onNameInput(e) {
    this.setData({
      userName: e.detail.value
    })
  },

  // 提交订单
  async submitOrder() {
    const userName = this.data.userName.trim()
    
    if (!userName) {
      wx.showToast({
        title: '请输入您的姓名',
        icon: 'none'
      })
      return
    }

    try {
      const result = await API.anonymousOrder.create(
        this.data.mealId,
        this.data.selectedDishes,
        this.data.shareToken,
        userName
      )

      wx.showToast({
        title: '下单成功',
        icon: 'success'
      })

      this.setData({
        hasOrdered: true,
        showNameInput: false,
        showEnterKitchenButton: true
      })

      // 刷新点餐详情
      this.loadSharedMeal()
    } catch (err) {
      console.error('下单失败:', err)
      wx.showToast({
        title: err.message || '下单失败',
        icon: 'none'
      })
    }
  },

  // 进入我的厨房
  async enterMyKitchen() {
    try {
      // 检查是否已有厨房
      const result = await API.kitchen.list()
      const kitchens = result.data.list || []

      if (kitchens.length === 0) {
        // 创建默认厨房
        await API.kitchen.create('我的厨房')
      }

      // 跳转到首页
      wx.switchTab({
        url: '/pages/index/index'
      })
    } catch (err) {
      console.error('进入厨房失败:', err)
      wx.showToast({
        title: '进入失败，请重试',
        icon: 'none'
      })
    }
  }
})
