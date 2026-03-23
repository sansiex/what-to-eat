// pages/share-meal/share-meal.js
const { API } = require('../../utils/cloud-api.js')
const { formatMealCreatedAtBeijing } = require('../../utils/format-meal-created-at-beijing.js')
const { previewSingleDishImage } = require('../../utils/dish-preview.js')

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
    
    if (!mealId) {
      wx.showToast({
        title: '分享链接无效',
        icon: 'none'
      })
      return
    }

    this.setData({
      shareToken: token || '',
      mealId: parseInt(mealId)
    })

    // 检查用户是否已设置昵称
    const userInfo = wx.getStorageSync('userInfo')
    if (userInfo && userInfo.nickName && userInfo.nickName !== '微信用户') {
      this.setData({ userName: userInfo.nickName })
    }

    // 加载分享的点餐详情
    this.loadSharedMeal()
  },

  // 加载分享的点餐详情
  async loadSharedMeal() {
    try {
      if (!this.data.shareToken) {
        // 没有 token 时，尝试以当前用户身份生成（仅发起人能成功）
        try {
          const gen = await API.share.generateShareLink(this.data.mealId)
          const shareToken = gen && gen.data && gen.data.shareToken
          if (shareToken) {
            this.setData({ shareToken })
          }
        } catch (e) {
          console.warn('生成分享令牌失败（非发起人属正常）:', e)
        }
      }

      if (!this.data.shareToken) {
        wx.showToast({ title: '分享链接无效', icon: 'none' })
        return
      }

      const result = await API.share.getByShareToken(
        this.data.shareToken,
        this.data.mealId
      )

      const meal = result.data
      console.log('Loaded meal data:', meal)
      
      // 默认选中所有菜品
      const selectedDishes = meal.dishes.map(d => d.id)
      const dishSelectionMap = {}
      meal.dishes.forEach(dish => {
        dishSelectionMap[dish.id] = true
      })

      // 预处理菜品数据，将orderers数组转换为字符串
      const dishes = meal.dishes.map(dish => ({
        ...dish,
        imageUrl: dish.imageUrl || dish.image_url || '',
        displayImage: (dish.imageUrl || dish.image_url) || '/images/dish-placeholder.png',
        displayDescription: dish.description || '暂无描述',
        orderersText: dish.orderers && dish.orderers.length > 0 
          ? dish.orderers.join('、') 
          : ''
      }))

      this.setData({
        meal: {
          ...meal,
          formattedCreatedAt: formatMealCreatedAtBeijing(meal.createdAt)
        },
        dishes: dishes,
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

  // 显示姓名输入框（已废弃，直接获取微信昵称）
  showNameInput() {
    if (this.data.selectedDishes.length === 0) {
      wx.showToast({
        title: '请至少选择一个菜品',
        icon: 'none'
      })
      return
    }

    // 直接获取用户信息并下单
    this.getUserProfileAndSubmit()
  },

  // 获取用户信息并提交订单
  getUserProfileAndSubmit() {
    // 优先使用已保存的用户昵称
    const userInfo = wx.getStorageSync('userInfo')
    if (userInfo && userInfo.nickName && userInfo.nickName !== '微信用户') {
      this.setData({ userName: userInfo.nickName })
      this.submitOrder()
      return
    }

    // 如果未设置昵称，提示用户先设置
    wx.showModal({
      title: '提示',
      content: '请先设置您的昵称后再下单',
      confirmText: '去设置',
      success: (res) => {
        if (res.confirm) {
          // 跳转到登录页
          const currentUrl = `/pages/share-meal/share-meal?token=${this.data.shareToken}&mealId=${this.data.mealId}`
          wx.navigateTo({
            url: `/pages/login/login?redirect=${encodeURIComponent(currentUrl)}`
          })
        }
      }
    })
  },

  previewDishImage(e) {
    previewSingleDishImage(e.currentTarget.dataset.url)
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
