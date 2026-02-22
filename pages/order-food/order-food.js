// pages/order-food/order-food.js
Page({
  data: {
    currentMeal: null,
    searchKeyword: '',
    filteredDishes: [],
    userSelectedDishes: [],
    orders: [] // 存储所有用户的订单
  },
  
  onLoad() {
    // 加载当前餐食数据
    this.loadCurrentMeal()
    // 加载订单数据
    this.loadOrders()
  },
  
  loadCurrentMeal() {
    const currentMeal = wx.getStorageSync('currentMeal')
    if (currentMeal) {
      this.setData({
        currentMeal,
        filteredDishes: currentMeal.dishes
      })
    }
  },
  
  loadOrders() {
    const orders = wx.getStorageSync('orders') || []
    this.setData({ orders })
  },
  
  onSearch(e) {
    const keyword = e.detail.value
    this.setData({ searchKeyword: keyword })
    this.filterDishes(keyword)
  },
  
  filterDishes(keyword) {
    if (!this.data.currentMeal) return
    
    const dishes = this.data.currentMeal.dishes
    const filteredDishes = dishes.filter(dish => 
      dish.name.toLowerCase().includes(keyword.toLowerCase())
    )
    this.setData({ filteredDishes })
  },
  
  toggleDishSelection(e) {
    const id = e.currentTarget.dataset.id
    const userSelectedDishes = [...this.data.userSelectedDishes]
    const index = userSelectedDishes.indexOf(id)
    
    if (index === -1) {
      userSelectedDishes.push(id)
    } else {
      userSelectedDishes.splice(index, 1)
    }
    
    this.setData({ userSelectedDishes })
  },
  
  placeOrder() {
    if (!this.data.currentMeal) {
      wx.showToast({ title: '暂无发起的餐食', icon: 'none' })
      return
    }
    
    if (this.data.userSelectedDishes.length === 0) {
      wx.showToast({ title: '请至少选择一个菜品', icon: 'none' })
      return
    }
    
    // 模拟获取当前用户（实际项目中从微信登录获取）
    const currentUser = '用户' + Math.floor(Math.random() * 1000)
    
    // 创建订单
    const order = {
      id: String(Date.now()),
      userId: currentUser,
      userName: currentUser,
      mealId: this.data.currentMeal.id,
      selectedDishes: this.data.userSelectedDishes,
      createdAt: new Date().toISOString()
    }
    
    // 保存订单
    const orders = [...this.data.orders, order]
    wx.setStorageSync('orders', orders)
    
    // 模拟上传到后台
    this.uploadOrder(order)
    
    // 显示成功提示
    wx.showToast({ title: '下单成功', icon: 'success' })
    
    // 刷新订单数据
    this.setData({ 
      orders,
      userSelectedDishes: [] // 清空用户选择
    })
  },
  
  uploadOrder(order) {
    // 模拟后台请求
    console.log('上传订单数据到后台:', order)
    // 实际项目中这里会调用 wx.request 发送请求
  },
  
  getDishOrderers(dishId) {
    const orders = this.data.orders
    const orderers = []
    
    orders.forEach(order => {
      if (order.selectedDishes.includes(dishId)) {
        orderers.push(order.userName)
      }
    })
    
    return orderers
  },
  
  formatTime(timeString) {
    const date = new Date(timeString)
    const year = date.getFullYear()
    const month = (date.getMonth() + 1).toString().padStart(2, '0')
    const day = date.getDate().toString().padStart(2, '0')
    const hours = date.getHours().toString().padStart(2, '0')
    const minutes = date.getMinutes().toString().padStart(2, '0')
    
    return `${year}-${month}-${day} ${hours}:${minutes}`
  }
})