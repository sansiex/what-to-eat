// pages/initiate-meal/initiate-meal.js
Page({
  data: {
    mealTypes: ['午餐', '晚餐'],
    selectedMealName: '',
    showCustomDialog: false,
    showCustomInput: false,
    customMealName: '',
    dishes: [],
    selectedDishes: [],
    selectAll: true
  },
  
  onLoad() {
    // 加载菜品数据
    this.loadDishes()
  },
  
  loadDishes() {
    const dishes = wx.getStorageSync('dishes') || []
    const selectedDishes = dishes.map(dish => dish.id)
    this.setData({
      dishes,
      selectedDishes
    })
  },
  
  selectMealType(e) {
    const type = e.currentTarget.dataset.type
    this.setData({
      selectedMealName: type,
      showCustomInput: false,
      customMealName: ''
    })
  },
  
  showCustomMealDialog() {
    this.setData({ 
      showCustomDialog: true,
      customMealName: ''
    })
  },
  
  hideCustomDialog() {
    this.setData({ showCustomDialog: false })
  },
  
  onCustomMealInput(e) {
    this.setData({ customMealName: e.detail.value })
  },
  
  confirmCustomMeal() {
    const name = this.data.customMealName.trim()
    if (!name) {
      wx.showToast({ title: '请输入餐名', icon: 'none' })
      return
    }
    
    this.setData({
      selectedMealName: name,
      showCustomDialog: false
    })
  },
  
  toggleSelectAll() {
    const selectAll = !this.data.selectAll
    let selectedDishes = []
    
    if (selectAll) {
      selectedDishes = this.data.dishes.map(dish => dish.id)
    }
    
    this.setData({ selectAll, selectedDishes })
  },
  
  toggleDishSelection(e) {
    const id = e.currentTarget.dataset.id
    const selectedDishes = [...this.data.selectedDishes]
    const index = selectedDishes.indexOf(id)
    
    if (index === -1) {
      selectedDishes.push(id)
    } else {
      selectedDishes.splice(index, 1)
    }
    
    // 更新全选状态
    const selectAll = selectedDishes.length === this.data.dishes.length
    
    this.setData({ selectedDishes, selectAll })
  },
  
  initiateMeal() {
    const { selectedMealName, selectedDishes, dishes } = this.data
    
    if (!selectedMealName) {
      wx.showToast({ title: '请选择餐名', icon: 'none' })
      return
    }
    
    if (selectedDishes.length === 0) {
      wx.showToast({ title: '请选择菜品', icon: 'none' })
      return
    }
    
    // 构建餐食数据
    const selectedDishDetails = dishes.filter(dish => selectedDishes.includes(dish.id))
    const mealData = {
      id: String(Date.now()),
      name: selectedMealName,
      dishes: selectedDishDetails,
      createdAt: new Date().toISOString()
    }
    
    // 存储到本地
    wx.setStorageSync('currentMeal', mealData)
    
    // 模拟上传到后台
    this.uploadMealData(mealData)
    
    // 跳转到点餐页面
    wx.navigateTo({ url: '/pages/order-food/order-food' })
  },
  
  uploadMealData(mealData) {
    // 模拟后台请求
    console.log('上传餐食数据到后台:', mealData)
    // 实际项目中这里会调用 wx.request 发送请求
  }
})