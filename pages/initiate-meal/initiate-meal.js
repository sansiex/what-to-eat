// pages/initiate-meal/initiate-meal.js
const { API } = require('../../utils/cloud-api.js')

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
    if (!this.data.isEditMode) {
      this.loadDishes()
    }
  },

  // 加载正在编辑的餐食数据
  async loadEditingMeal() {
    const editingMeal = getApp().globalData.editingMeal
    if (!editingMeal) {
      wx.showToast({ title: '没有要编辑的点餐', icon: 'none' })
      wx.navigateBack()
      return
    }

    console.log('加载编辑的餐食数据:', editingMeal)

    try {
      // 获取所有菜品
      const result = await API.dish.list()
      const allDishes = result.data.list || []

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
    } catch (err) {
      console.error('加载编辑数据失败:', err)
      wx.showToast({ title: '加载失败', icon: 'none' })
    }
  },

  async loadDishes() {
    try {
      const result = await API.dish.list()
      const dishes = result.data.list || []
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
    } catch (err) {
      console.error('加载菜品失败:', err)
    }
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
  async completeEdit() {
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

    try {
      // 调用云函数更新点餐
      const selectedDishIds = selectedDishDetails.map(d => d.id)
      await API.meal.update(editingMealId, selectedMealName, selectedDishIds)

      // 清除编辑状态
      getApp().globalData.editingMeal = null

      wx.showToast({ title: '修改成功', icon: 'success' })

      // 返回上一页
      setTimeout(() => {
        wx.navigateBack()
      }, 1500)
    } catch (err) {
      console.error('更新点餐失败:', err)
    }
  },

  // 返回（取消编辑）
  goBack() {
    getApp().globalData.editingMeal = null
    wx.navigateBack()
  },

  async initiateMeal() {
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

    try {
      // 调用云函数创建点餐
      const selectedDishIds = selectedDishDetails.map(d => d.id)
      const result = await API.meal.create(selectedMealName, selectedDishIds)
      const mealData = result.data

      console.log('创建点餐成功:', mealData)

      // 存储当前点餐到全局数据
      getApp().globalData.currentMeal = mealData

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
    } catch (err) {
      console.error('创建点餐失败:', err)
      wx.hideLoading()
    }
  }
})
