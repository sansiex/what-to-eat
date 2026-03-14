// pages/menu-edit/menu-edit.js
const { API } = require('../../utils/cloud-api.js')

Page({
  data: {
    isEditMode: false,
    menuName: '',
    allDishes: [],
    filteredDishes: [],
    selectedDishIds: [],
    searchKeyword: '',
    showAddDishDialog: false,
    newDishName: ''
  },

  onLoad(options) {
    const { mode } = options || {}
    
    if (mode === 'edit') {
      this.loadEditData()
    } else {
      this.loadAllDishes()
    }
  },

  // 加载编辑数据
  loadEditData() {
    const menu = getApp().globalData.currentMenu
    
    if (!menu) {
      wx.showToast({ title: '没有要编辑的菜单', icon: 'none' })
      wx.navigateBack()
      return
    }

    this.setData({
      isEditMode: true,
      menuName: menu.name,
      selectedDishIds: menu.dishes.map(d => d.id)
    })

    this.loadAllDishes()
  },

  // 加载所有菜品
  async loadAllDishes() {
    try {
      const result = await API.dish.list()
      const dishes = result.data.list || []
      const { selectedDishIds } = this.data
      
      // 为每个菜品添加 selected 属性
      const dishesWithSelected = dishes.map(dish => ({
        ...dish,
        selected: selectedDishIds.includes(dish.id)
      }))
      
      this.setData({
        allDishes: dishesWithSelected,
        filteredDishes: dishesWithSelected
      })
    } catch (err) {
      console.error('加载菜品失败:', err)
      wx.showToast({ title: '加载菜品失败', icon: 'none' })
    }
  },

  // 输入菜单名称
  onMenuNameInput(e) {
    this.setData({ menuName: e.detail.value })
  },

  // 搜索菜品
  onSearch(e) {
    const keyword = e.detail.value.toLowerCase()
    const { allDishes } = this.data
    
    const filtered = allDishes.filter(dish => 
      dish.name.toLowerCase().includes(keyword)
    )

    this.setData({
      searchKeyword: keyword,
      filteredDishes: filtered
    })
  },

  // 切换菜品选择
  toggleDishSelection(e) {
    const dishId = parseInt(e.currentTarget.dataset.id)
    const { allDishes, filteredDishes, selectedDishIds } = this.data
    
    // 切换选中状态
    const isSelected = selectedDishIds.includes(dishId)
    let newSelectedIds
    if (isSelected) {
      newSelectedIds = selectedDishIds.filter(id => id !== dishId)
    } else {
      newSelectedIds = [...selectedDishIds, dishId]
    }

    // 更新所有菜品列表中的选中状态
    const updateDishes = (dishes) => dishes.map(dish => ({
      ...dish,
      selected: newSelectedIds.includes(dish.id)
    }))

    this.setData({
      allDishes: updateDishes(allDishes),
      filteredDishes: updateDishes(filteredDishes),
      selectedDishIds: newSelectedIds
    })
  },

  // 显示新增菜品弹窗
  showAddDishDialog() {
    this.setData({
      showAddDishDialog: true,
      newDishName: ''
    })
  },

  // 隐藏新增菜品弹窗
  hideAddDishDialog() {
    this.setData({
      showAddDishDialog: false,
      newDishName: ''
    })
  },

  // 输入新菜品名称
  onNewDishNameInput(e) {
    this.setData({ newDishName: e.detail.value })
  },

  // 确认添加菜品
  async confirmAddDish() {
    const { newDishName } = this.data
    
    if (!newDishName.trim()) {
      wx.showToast({ title: '请输入菜品名称', icon: 'none' })
      return
    }

    try {
      wx.showLoading({ title: '添加中...' })
      
      // 创建菜品
      const result = await API.dish.create(newDishName.trim(), '')
      const newDish = result.data
      
      wx.hideLoading()
      
      // 添加到列表并选中
      const { allDishes, filteredDishes, selectedDishIds } = this.data
      const dishWithSelected = { ...newDish, selected: true }
      
      this.setData({
        allDishes: [...allDishes, dishWithSelected],
        filteredDishes: [...filteredDishes, dishWithSelected],
        selectedDishIds: [...selectedDishIds, newDish.id],
        showAddDishDialog: false,
        newDishName: ''
      })
      
      wx.showToast({ title: '添加成功', icon: 'success' })
    } catch (err) {
      wx.hideLoading()
      console.error('添加菜品失败:', err)
      wx.showToast({ title: '添加失败', icon: 'none' })
    }
  },

  // 保存菜单
  async saveMenu() {
    const { isEditMode, menuName, selectedDishIds } = this.data

    if (!menuName.trim()) {
      wx.showToast({ title: '请输入菜单名称', icon: 'none' })
      return
    }

    if (selectedDishIds.length === 0) {
      wx.showToast({ title: '请至少选择一个菜品', icon: 'none' })
      return
    }

    // 获取当前厨房
    let currentKitchen = getApp().globalData.currentKitchen

    // 如果没有当前厨房，尝试初始化
    if (!currentKitchen) {
      await getApp().initDefaultKitchen()
      currentKitchen = getApp().globalData.currentKitchen
    }

    if (!currentKitchen) {
      wx.showToast({ title: '请先选择厨房', icon: 'none' })
      return
    }

    try {
      wx.showLoading({ title: isEditMode ? '更新中...' : '创建中...' })

      if (isEditMode) {
        const menu = getApp().globalData.currentMenu
        await API.menu.update({
          id: menu.id,
          name: menuName.trim(),
          dishIds: selectedDishIds
        })
        wx.showToast({ title: '更新成功', icon: 'success' })
      } else {
        await API.menu.create({
          name: menuName.trim(),
          dishIds: selectedDishIds,
          kitchenId: currentKitchen.id
        })
        wx.showToast({ title: '创建成功', icon: 'success' })
      }

      wx.hideLoading()
      wx.navigateBack()
    } catch (err) {
      wx.hideLoading()
      console.error(isEditMode ? '更新菜单失败:' : '创建菜单失败:', err)
      wx.showToast({ title: isEditMode ? '更新失败' : '创建失败', icon: 'none' })
    }
  }
})
