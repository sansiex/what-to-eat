// pages/order-food/order-food.js
const { API } = require('../../utils/cloud-api.js')

Page({
  data: {
    currentMeal: null,
    searchKeyword: '',
    filteredDishes: [],
    userSelectedDishes: [],
    dishSelectionMap: {}, // 用于存储每个菜品的选中状态
    orders: [],
    orderStats: [], // 订单统计
    updateTimestamp: Date.now(),
    viewMode: false, // 是否为查看模式（只读）
    isInitiator: false // 是否是点餐发起人
  },

  onLoad() {
    // 检查是否为查看模式
    const viewMode = getApp().globalData.viewMode || false
    this.setData({ viewMode })

    this.loadCurrentMeal()
    this.loadOrders()
  },

  // 获取微信用户信息
  getUserInfo(callback) {
    // 开发环境可以设置测试用户名（正式发布时请删除或注释掉这行）
    const testUserName = '' // 例如：'张三'

    if (testUserName) {
      wx.setStorageSync('currentUser', testUserName)
      wx.setStorageSync('currentUserName', testUserName)
      console.log('使用测试用户名:', testUserName)
      if (callback) callback()
      return
    }

    wx.getUserProfile({
      desc: '用于展示用户昵称',
      success: (res) => {
        const userInfo = res.userInfo
        wx.setStorageSync('currentUser', userInfo.nickName)
        wx.setStorageSync('currentUserName', userInfo.nickName)
        console.log('获取用户信息成功:', userInfo.nickName)
        if (callback) callback()
      },
      fail: (err) => {
        console.log('获取用户信息失败:', err)
        // 如果获取失败，使用默认的随机用户
        let currentUser = wx.getStorageSync('currentUser')
        if (!currentUser) {
          currentUser = '用户' + Math.floor(Math.random() * 1000)
          wx.setStorageSync('currentUser', currentUser)
          wx.setStorageSync('currentUserName', currentUser)
        }
        if (callback) callback()
      }
    })
  },

  onShow() {
    // 检查是否为查看模式
    const viewMode = getApp().globalData.viewMode || false
    this.setData({ viewMode })

    // 检查是否需要重新加载餐食（globalData中的餐食与当前不同）
    const globalMeal = getApp().globalData.currentMeal
    const currentMeal = this.data.currentMeal

    if (globalMeal && (!currentMeal || currentMeal.id !== globalMeal.id)) {
      // 餐食发生变化，重新加载
      this.loadCurrentMeal()
    } else if (currentMeal) {
      // 餐食未变，只刷新订单统计和点选信息，不覆盖用户选择
      this.loadOrderStats(currentMeal.id)
      // 刷新点选信息映射
      this.refreshDishOrderersMap()
    }
  },

  onHide() {
    // 离开页面时清除查看模式标记
    getApp().globalData.viewMode = false
  },

  // 格式化时间为北京时间
  formatBeijingTime(isoString) {
    console.log('formatBeijingTime被调用，输入:', isoString)
    if (!isoString) {
      console.log('输入为空，返回空字符串')
      return ''
    }
    try {
      const date = new Date(isoString)
      console.log('解析的日期:', date)
      // 转换为北京时间 (UTC+8)
      const beijingTime = new Date(date.getTime() + 8 * 60 * 60 * 1000)
      const year = beijingTime.getUTCFullYear()
      const month = String(beijingTime.getUTCMonth() + 1).padStart(2, '0')
      const day = String(beijingTime.getUTCDate()).padStart(2, '0')
      const hours = String(beijingTime.getUTCHours()).padStart(2, '0')
      const minutes = String(beijingTime.getUTCMinutes()).padStart(2, '0')
      const result = `${year}-${month}-${day} ${hours}:${minutes}`
      console.log('格式化结果:', result)
      return result
    } catch (e) {
      console.log('格式化失败:', e)
      return ''
    }
  },

  // 加载当前餐食数据
  async loadCurrentMeal() {
    const globalMeal = getApp().globalData.currentMeal
    console.log('globalData中的餐食:', globalMeal)

    if (!globalMeal) {
      this.setData({ currentMeal: null })
      return
    }

    try {
      // 从云函数获取完整的餐食详情（包含菜品列表）
      const result = await API.meal.get(globalMeal.id)
      const currentMeal = result.data

      console.log('从云函数获取的餐食详情:', currentMeal)
      console.log('餐食中的菜品:', currentMeal.dishes)
      console.log('菜品数量:', currentMeal.dishes ? currentMeal.dishes.length : 0)

      if (!currentMeal.dishes || currentMeal.dishes.length === 0) {
        wx.showToast({ title: '该点餐没有关联菜品', icon: 'none' })
        this.setData({ currentMeal: null })
        return
      }

      // 检查是否餐食发生变化，如果是则重置为默认选中所有
      const mealChanged = !this.data.currentMeal || this.data.currentMeal.id !== currentMeal.id
      let userSelectedDishes

      if (mealChanged) {
        // 如果餐食变化，则默认勾选所有菜品
        userSelectedDishes = currentMeal.dishes.map(dish => dish.id)
      } else {
        // 如果餐食未变，则保持原有的选择状态
        userSelectedDishes = this.data.userSelectedDishes
      }

      // 构建菜品选择状态映射
      const dishSelectionMap = {}
      currentMeal.dishes.forEach(dish => {
        dishSelectionMap[dish.id] = userSelectedDishes.includes(dish.id)
      })

      // 构建菜品点选信息映射（使用云函数返回的 orderers 数据）
      const dishOrderersMap = {}
      currentMeal.dishes.forEach(dish => {
        const orderers = dish.orderers || []
        dishOrderersMap[dish.id] = orderers.length > 0 ? '已点：' + orderers.join('、') : '暂无点选'
      })

      const dishesWithDisplay = currentMeal.dishes.map(dish => ({
        ...dish,
        imageUrl: dish.imageUrl || dish.image_url || '',
        displayImage: (dish.imageUrl || dish.image_url) || '/images/dish-placeholder.png',
        displayDescription: dish.description || '暂无描述'
      }))

      // 格式化创建时间
      const formattedCreatedAt = this.formatBeijingTime(currentMeal.createdAt)
      console.log('格式化后的创建时间:', formattedCreatedAt)

      // 创建带有格式化时间的 currentMeal 副本
      const currentMealWithFormattedTime = {
        ...currentMeal,
        formattedCreatedAt
      }

      // 判断当前用户是否是发起人（使用后端返回的 isCreator）
      const isInitiator = !!currentMeal.isCreator

      this.setData({
        currentMeal: currentMealWithFormattedTime,
        filteredDishes: dishesWithDisplay,
        userSelectedDishes,
        dishSelectionMap,
        dishOrderersMap,
        isInitiator
      })

      // 为发起人预生成分享令牌
      if (isInitiator) {
        this.preGenerateShareToken(currentMeal.id)
      }

      // 加载订单统计
      this.loadOrderStats(currentMeal.id)
    } catch (err) {
      console.error('加载餐食详情失败:', err)
      wx.showToast({ title: '加载餐食失败', icon: 'none' })
      this.setData({ currentMeal: null })
    }
  },

  // 加载订单统计
  async loadOrderStats(mealId) {
    if (!mealId) return
    try {
      const result = await API.order.listByMeal(mealId)
      // 后端返回的是 dishOrders，需要转换为前端需要的格式
      const dishOrders = result.data.dishOrders || []
      const orderStats = dishOrders.map(order => ({
        dishId: order.dishId,
        ordererNames: order.orderers || [],
        orderCount: order.orderCount
      }))
      this.setData({ orderStats })
    } catch (err) {
      console.error('加载订单统计失败:', err)
    }
  },

  // 加载订单数据（仅加载，不覆盖用户选择）
  async loadOrders() {
    const currentMeal = this.data.currentMeal
    if (!currentMeal) return

    try {
      // 刷新订单统计
      await this.loadOrderStats(currentMeal.id)
    } catch (err) {
      console.error('加载订单失败:', err)
    }
  },

  // 同步订单到选择状态（用于页面加载时恢复用户的订单选择）
  async syncOrderToSelection() {
    const currentMeal = this.data.currentMeal
    if (!currentMeal) return

    try {
      // 获取我在当前点餐中的订单
      const result = await API.order.getMyOrder(currentMeal.id)
      const myOrder = result.data

      // 如果用户已下单，同步到选择状态
      if (myOrder.hasOrdered && myOrder.orders) {
        const userSelectedDishes = myOrder.orders.map(o => o.dishId)
        const dishSelectionMap = {}
        this.data.filteredDishes.forEach(dish => {
          dishSelectionMap[dish.id] = userSelectedDishes.includes(dish.id)
        })

        this.setData({
          userSelectedDishes,
          dishSelectionMap
        })
      }
    } catch (err) {
      console.error('同步订单到选择失败:', err)
    }
  },

  // 搜索菜品
  onSearch(e) {
    const keyword = e.detail.value
    this.setData({ searchKeyword: keyword })
    this.filterDishes(keyword)
  },

  // 过滤菜品
  filterDishes(keyword) {
    if (!this.data.currentMeal) return

    const dishes = this.data.currentMeal.dishes
    const filteredDishes = dishes.filter(dish =>
      dish.name.toLowerCase().includes(keyword.toLowerCase())
    ).map(dish => ({
      ...dish,
      imageUrl: dish.imageUrl || dish.image_url || '',
      displayImage: (dish.imageUrl || dish.image_url) || '/images/dish-placeholder.png',
      displayDescription: dish.description || '暂无描述'
    }))
    this.setData({ filteredDishes })
  },

  // 处理checkbox-group的change事件
  onCheckboxChange(e) {
    console.log('onCheckboxChange被调用')
    console.log('事件对象:', e)

    // checkbox-group 返回的是字符串数组，需要转换为数字
    const selectedValues = (e.detail.value || []).map(v => parseInt(v))
    console.log('选中的值(转换后):', selectedValues)

    // 构建新的状态映射
    const newSelectionMap = {}
    this.data.filteredDishes.forEach(dish => {
      newSelectionMap[dish.id] = selectedValues.includes(dish.id)
    })

    console.log('更新后的状态映射:', newSelectionMap)
    console.log('更新后的选中列表:', selectedValues)

    // 强制更新数据
    this.setData({
      dishSelectionMap: newSelectionMap,
      userSelectedDishes: selectedValues
    })
  },

  // 检查菜品是否被选中
  isSelected(id) {
    const result = this.data.dishSelectionMap[id] || false
    console.log('isSelected检查:', id, '结果:', result, '当前选中列表:', this.data.userSelectedDishes)
    return result
  },

  // 获取点选该菜品的用户
  getDishOrderers(dishId) {
    const orderStats = this.data.orderStats
    const stat = orderStats.find(s => s.dishId === dishId)
    return stat ? stat.ordererNames : []
  },

  // 构建菜品点选信息映射
  buildDishOrderersMap() {
    const dishOrderersMap = {}
    const orderStats = this.data.orderStats

    this.data.filteredDishes.forEach(dish => {
      const stat = orderStats.find(s => s.dishId === dish.id)
      const orderers = stat ? stat.ordererNames : []
      dishOrderersMap[dish.id] = orderers.length > 0 ? '已点：' + orderers.join('、') : '暂无点选'
    })

    return dishOrderersMap
  },

  // 刷新菜品点选信息映射（不覆盖用户选择）
  refreshDishOrderersMap() {
    const dishOrderersMap = this.buildDishOrderersMap()
    this.setData({ dishOrderersMap })
  },

  // 获取菜品点选人数
  getDishOrderCount(dishId) {
    const orderStats = this.data.orderStats
    const stat = orderStats.find(s => s.dishId === dishId)
    return stat ? stat.orderCount : 0
  },

  // 下单
  async placeOrder() {
    if (!this.data.currentMeal) {
      wx.showToast({ title: '暂无发起的餐食', icon: 'none' })
      return
    }

    if (this.data.userSelectedDishes.length === 0) {
      wx.showToast({ title: '请至少选择一个菜品', icon: 'none' })
      return
    }

    try {
      // 调用云函数下单
      await API.order.create(this.data.currentMeal.id, this.data.userSelectedDishes)

      // 准备跳转到下单完成页面所需的数据
      getApp().globalData.orderCompleteData = {
        meal: this.data.currentMeal,
        allDishes: this.data.filteredDishes,
        orderedDishIds: [...this.data.userSelectedDishes],
        isCreator: this.data.isInitiator,
        shareToken: this.data.shareToken || ''
      }

      wx.navigateTo({ url: '/pages/order-complete/order-complete' })
    } catch (err) {
      console.error('下单失败:', err)
    }
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

  previewDishImage(e) {
    const url = e.currentTarget.dataset.url
    if (!url || url === '/images/dish-placeholder.png') return
    const urls = (this.data.filteredDishes || [])
      .map(function(d) { return d.displayImage || '' })
      .filter(function(u) { return u && u !== '/images/dish-placeholder.png' })
    wx.previewImage({
      current: url,
      urls: urls.length > 0 ? urls : [url]
    })
  },

  onShareAppMessage(e) {
    const mealId = (e && e.target && e.target.dataset && e.target.dataset.id) || (this.data.currentMeal && this.data.currentMeal.id)
    const mealName = (e && e.target && e.target.dataset && e.target.dataset.name) || (this.data.currentMeal && this.data.currentMeal.name)

    if (!mealId) {
      return {
        title: '今天吃什么？一起来点餐吧！',
        path: '/pages/meal-list/meal-list'
      }
    }

    const token = this.data.shareToken || ''
    const sharePath = token
      ? `/pages/share-meal/share-meal?token=${token}&mealId=${mealId}`
      : `/pages/share-meal/share-meal?mealId=${mealId}`

    return {
      title: `【${mealName || '点餐'}】快来一起点餐吧！`,
      path: sharePath,
      imageUrl: '/images/share_card.jpg'
    }
  }
})
