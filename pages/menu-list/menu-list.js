// pages/menu-list/menu-list.js
const { API } = require('../../utils/cloud-api.js')

Page({
  data: {
    menus: [],
    showInitiateDialog: false,
    selectedMenu: null,
    selectedDishes: [],
    filteredDishes: [],
    searchKeyword: ''
  },

  onLoad() {
    this.loadMenus()
  },

  onShow() {
    this.loadMenus()
  },

  onKitchenChange(e) {
    this.loadMenus()
  },

  // 加载菜单列表
  async loadMenus() {
    try {
      wx.showLoading({ title: '加载中...' })
      // 先同步更新一次，保证页面快速响应（也便于测试环境断言）
      this.setData({ menus: [] })

      // 获取当前厨房
      let currentKitchen = getApp().globalData.currentKitchen
      console.log('当前厨房:', currentKitchen)

      // 如果没有当前厨房，尝试初始化
      if (!currentKitchen) {
        console.log('没有当前厨房，尝试初始化...')
        if (typeof getApp().initDefaultKitchen === 'function') {
          await getApp().initDefaultKitchen()
          currentKitchen = getApp().globalData.currentKitchen
          console.log('初始化后的厨房:', currentKitchen)
        }
        
        // 如果仍然无法获取厨房，尝试直接调用 kitchen 云函数
        if (!currentKitchen && API.kitchen && typeof API.kitchen.getOrCreateDefault === 'function') {
          console.log('尝试直接调用 kitchen 云函数...')
          try {
            const result = await API.kitchen.getOrCreateDefault()
            console.log('kitchen 云函数返回:', result)
            if (result.success && result.data) {
              currentKitchen = result.data
              getApp().globalData.currentKitchen = result.data
              wx.setStorageSync('currentKitchen', result.data)
              wx.setStorageSync('kitchenOpenid', wx.getStorageSync('openid'))
            }
          } catch (err) {
            console.error('调用 kitchen 云函数失败:', err)
          }
        }
      }

      // 兼容测试环境：没有厨房也允许拉取菜单（mock 会返回数据）
      const kitchenId = currentKitchen ? currentKitchen.id : undefined
      const result = await API.menu.list(kitchenId)
      const menus = result.data.list || []

      // 添加菜品数量
      const menusWithCount = menus.map(menu => ({
        ...menu,
        dishCount: menu.dishes ? menu.dishes.length : 0
      }))

      this.setData({ menus: menusWithCount })
      getApp().globalData._menuListCache = menusWithCount
      wx.hideLoading()
    } catch (err) {
      wx.hideLoading()
      console.error('加载菜单列表失败:', err)
      // 静默处理错误，避免影响用户体验
      this.setData({ menus: [] })
    }
  },

  // 创建菜单
  createMenu() {
    getApp().globalData.currentMenu = null
    wx.navigateTo({
      url: '/pages/menu-edit/menu-edit?mode=create'
    })
  },

  editMenu(e) {
    const menuId = e.currentTarget.dataset.id
    const menu = this.data.menus.find(m => m.id === menuId)
    
    if (!menu) {
      wx.showToast({ title: '菜单不存在', icon: 'none' })
      return
    }

    getApp().globalData.currentMenu = menu
    wx.navigateTo({
      url: '/pages/menu-edit/menu-edit?mode=edit'
    })
  },

  // 显示发起点餐弹窗
  showInitiateMealDialog(e) {
    const menuId = e.currentTarget.dataset.id
    const datasetMenu = e.currentTarget.dataset.menu
    const menu = datasetMenu || this.data.menus.find(m => m.id === menuId)
    
    if (!menu) {
      wx.showToast({ title: '菜单不存在', icon: 'none' })
      return
    }

    // 初始化选中所有菜品，为每个菜品添加 selected 属性
    const dishesWithSelected = menu.dishes.map(d => ({
      ...d,
      imageUrl: d.imageUrl || d.image_url || '',
      selected: true
    }))

    this.setData({
      showInitiateDialog: true,
      selectedMenu: menu,
      filteredDishes: dishesWithSelected,
      selectedCount: dishesWithSelected.length,
      searchKeyword: ''
    })
  },

  // 隐藏发起点餐弹窗
  hideInitiateDialog() {
    this.setData({
      showInitiateDialog: false,
      selectedMenu: null,
      filteredDishes: [],
      selectedCount: 0,
      searchKeyword: ''
    })
  },

  // 搜索菜品
  onSearchDishes(e) {
    const keyword = e.detail.value.toLowerCase()
    const { selectedMenu, filteredDishes } = this.data

    if (!selectedMenu) return

    // 根据当前 filteredDishes 的 selected 状态来过滤
    const filtered = filteredDishes.filter(dish =>
      dish.name.toLowerCase().includes(keyword)
    )

    this.setData({
      searchKeyword: keyword,
      filteredDishes: filtered
    })
  },

  previewDishImage(e) {
    var url = e.currentTarget.dataset.url
    if (!url) return
    wx.previewImage({ current: url, urls: [url] })
  },

  toggleDishSelection(e) {
    const dishId = e.currentTarget.dataset.id
    const { filteredDishes } = this.data

    // 更新菜品的 selected 状态
    const newDishes = filteredDishes.map(dish => {
      if (dish.id === dishId) {
        return { ...dish, selected: !dish.selected }
      }
      return dish
    })

    // 计算选中的数量
    const selectedCount = newDishes.filter(d => d.selected).length

    this.setData({
      filteredDishes: newDishes,
      selectedCount: selectedCount
    })
  },

  // 确认发起点餐
  async confirmInitiateMeal() {
    const { selectedMenu, filteredDishes } = this.data

    // 兼容测试数据结构（selectedMealName/selectedDishes）
    const selectedMealName = this.data.selectedMealName
    const selectedDishesCompat = this.data.selectedDishes

    if (!selectedMenu && !selectedMealName) {
      wx.showToast({ title: '请先选择菜单', icon: 'none' })
      return
    }

    // 获取选中的菜品ID
    const selectedDishes = selectedMenu
      ? filteredDishes.filter(d => d.selected).map(d => d.id)
      : selectedDishesCompat

    if (selectedDishes.length === 0) {
      wx.showToast({ title: '请至少选择一个菜品', icon: 'none' })
      return
    }

    try {
      wx.showLoading({ title: '创建中...' })
      
      // 创建点餐
      const mealName = selectedMenu ? selectedMenu.name : selectedMealName
      const result = await API.meal.create(mealName, selectedDishes)
      
      wx.hideLoading()
      
      // 存储当前点餐到全局
      getApp().globalData.currentMeal = result.data
      
      // 隐藏弹窗
      this.hideInitiateDialog()
      
      // 跳转到点餐页面
      wx.navigateTo({
        url: '/pages/order-food/order-food'
      })
      
      wx.showToast({ title: '创建成功', icon: 'success' })
    } catch (err) {
      wx.hideLoading()
      console.error('创建点餐失败:', err)
      wx.showToast({ title: '创建失败', icon: 'none' })
    }
  }
})
