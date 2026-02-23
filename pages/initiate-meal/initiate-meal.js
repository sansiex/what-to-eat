// pages/initiate-meal/initiate-meal.js
Page({
  data: {
    mealTypes: ['早餐', '午餐', '晚餐'],
    selectedMealName: '',
    showCustomDialog: false,
    showCustomInput: false,
    customMealName: '',
    dishes: [],
    selectedDishes: [],
    selectAll: true,
    isEditMode: false,
    editingMealId: ''
  },
  
  onLoad(options) {
    // 检查是否是编辑模式
    if (options && options.mode === 'edit') {
      this.setData({ isEditMode: true })
      this.loadEditingMeal()
    } else {
      // 加载菜品数据
      this.loadDishes()
    }
  },
  
  onShow() {
    // 页面显示时重新加载菜品数据，确保获取最新数据
    this.loadDishes()
  },
  
  // 加载正在编辑的餐食数据
  loadEditingMeal() {
    const editingMeal = wx.getStorageSync('editingMeal')
    if (!editingMeal) {
      wx.showToast({ title: '没有要编辑的点餐', icon: 'none' })
      wx.navigateBack()
      return
    }

    console.log('加载编辑的餐食数据:', editingMeal)

    // 获取所有菜品
    const allDishes = wx.getStorageSync('dishes') || []

    // 构建菜品选择状态
    const mealDishIds = editingMeal.dishes.map(d => d.id)
    const dishesWithSelected = allDishes.map(dish => ({
      ...dish,
      selected: mealDishIds.includes(dish.id)
    }))

    const selectedDishes = dishesWithSelected.filter(d => d.selected).map(d => d.id)

    this.setData({
      editingMealId: editingMeal.id,
      selectedMealName: editingMeal.name,
      dishes: dishesWithSelected,
      selectedDishes,
      selectAll: selectedDishes.length === allDishes.length && allDishes.length > 0
    })
  },

  loadDishes() {
    const dishes = wx.getStorageSync('dishes') || []
    console.log('加载的菜品数据:', dishes)

    // 确保selectedDishes数组包含所有菜品的ID
    const selectedDishes = dishes.map(dish => dish.id)
    console.log('默认选中的菜品ID:', selectedDishes)

    // 为每个菜品添加一个selected属性
    const dishesWithSelected = dishes.map(dish => ({
      ...dish,
      selected: true // 默认全选
    }))

    this.setData({
      dishes: dishesWithSelected,
      selectedDishes,
      selectAll: selectedDishes.length > 0
    }, () => {
      // 数据更新完成后的回调
      console.log('数据更新完成，selectedDishes:', this.data.selectedDishes)
      console.log('数据更新完成，selectAll:', this.data.selectAll)
      console.log('数据更新完成，dishes:', this.data.dishes)
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
    const dishes = [...this.data.dishes].map(dish => ({
      ...dish,
      selected: selectAll
    }))
    
    // 更新selectedDishes数组
    const selectedDishes = selectAll ? dishes.map(dish => dish.id) : []
    
    this.setData({
      dishes,
      selectedDishes,
      selectAll
    }, () => {
      console.log('切换全选状态后，selectedDishes:', this.data.selectedDishes)
      console.log('切换全选状态后，selectAll:', this.data.selectAll)
      console.log('切换全选状态后，dishes:', this.data.dishes)
    })
  },
  
  toggleDishSelection(e) {
    const id = e.currentTarget.dataset.id
    
    console.log('toggleDishSelection被调用，id:', id)
    
    const dishes = [...this.data.dishes]
    const dishIndex = dishes.findIndex(dish => dish.id === id)
    
    if (dishIndex !== -1) {
      // 切换菜品的选中状态
      dishes[dishIndex].selected = !dishes[dishIndex].selected
      
      console.log('菜品', id, '的选中状态变为:', dishes[dishIndex].selected)
      
      // 更新selectedDishes数组
      const selectedDishes = dishes.filter(dish => dish.selected).map(dish => dish.id)
      
      // 更新全选状态
      const selectAll = selectedDishes.length === dishes.length && dishes.length > 0
      
      console.log('更新前dishes:', this.data.dishes)
      console.log('更新后dishes:', dishes)
      console.log('selectedDishes:', selectedDishes)
      
      this.setData({
        dishes,
        selectedDishes,
        selectAll
      }, () => {
        console.log('切换菜品选中状态后，selectedDishes:', this.data.selectedDishes)
        console.log('切换菜品选中状态后，selectAll:', this.data.selectAll)
        console.log('切换菜品选中状态后，dishes:', this.data.dishes)
      })
    }
  },
  
  // 完成编辑
  completeEdit() {
    const { selectedMealName, dishes, editingMealId } = this.data

    if (!selectedMealName) {
      wx.showToast({ title: '请选择餐名', icon: 'none' })
      return
    }

    const selectedDishDetails = dishes.filter(dish => dish.selected)
    if (selectedDishDetails.length === 0) {
      wx.showToast({ title: '请选择菜品', icon: 'none' })
      return
    }

    // 获取所有餐食
    let meals = wx.getStorageSync('meals') || []

    // 找到要编辑的餐食
    const mealIndex = meals.findIndex(m => m.id === editingMealId)
    if (mealIndex === -1) {
      wx.showToast({ title: '点餐不存在', icon: 'none' })
      return
    }

    // 更新餐食数据
    meals[mealIndex] = {
      ...meals[mealIndex],
      name: selectedMealName,
      dishes: selectedDishDetails
    }

    // 保存到本地存储
    wx.setStorageSync('meals', meals)

    // 清除编辑状态
    wx.removeStorageSync('editingMeal')

    wx.showToast({ title: '修改成功', icon: 'success' })

    // 返回上一页
    setTimeout(() => {
      wx.navigateBack()
    }, 1500)
  },

  // 返回（取消编辑）
  goBack() {
    wx.removeStorageSync('editingMeal')
    wx.navigateBack()
  },

  initiateMeal() {
    console.log('initiateMeal函数被调用')
    const { selectedMealName } = this.data
    
    // 重新获取最新的 dishes 数据
    const dishes = this.data.dishes
    
    console.log('当前数据:', { selectedMealName, dishesLength: dishes.length })

    if (!selectedMealName) {
      console.log('未选择餐名')
      wx.showToast({ title: '请选择餐名', icon: 'none' })
      return
    }

    // 使用dishes数组中每个菜品的selected属性来过滤选中的菜品
    const selectedDishDetails = dishes.filter(dish => dish.selected)
    console.log('所有菜品:', dishes)
    console.log('选中的菜品:', selectedDishDetails)
    console.log('选中的菜品数量:', selectedDishDetails.length)

    if (selectedDishDetails.length === 0) {
      console.log('未选择菜品')
      wx.showToast({ title: '请选择菜品', icon: 'none' })
      return
    }

    // 显示加载提示
    wx.showLoading({ title: '正在创建点餐流程...' })

    // 构建餐食数据
    const mealData = {
      id: String(Date.now()),
      name: selectedMealName,
      dishes: selectedDishDetails,
      status: 'ordering',
      createdAt: new Date().toISOString()
    }

    console.log('构建的餐食数据:', mealData)

    // 存储到本地
    wx.setStorageSync('currentMeal', mealData)

    // 同时添加到 meals 列表
    let meals = wx.getStorageSync('meals') || []
    meals.push(mealData)
    wx.setStorageSync('meals', meals)

    console.log('已存储餐食数据到本地存储')

    // 模拟上传到后台
    this.uploadMealData(mealData)

    // 跳转到点餐页面
    console.log('准备跳转到点餐页面')
    wx.switchTab({
      url: '/pages/order-food/order-food',
      success: function(res) {
        console.log('跳转成功:', res)
        wx.hideLoading()
      },
      fail: function(res) {
        console.log('跳转失败:', res)
        wx.hideLoading()
        wx.showToast({ title: '跳转失败，请重试', icon: 'none' })
      }
    })
  },
  
  uploadMealData(mealData) {
    // 模拟后台请求
    console.log('上传餐食数据到后台:', mealData)
    // 实际项目中这里会调用 wx.request 发送请求
  }
})