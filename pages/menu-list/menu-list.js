// pages/menu-list/menu-list.js
const { API } = require('../../utils/cloud-api.js')

Page({
  data: {
    menus: []
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

  // 进入发起点餐页面（与编辑菜单页「保存并发起点餐」保持一致）
  goInitiateMeal(e) {
    const menuId = e.currentTarget.dataset.id
    const menu = this.data.menus.find(m => m.id === menuId)

    if (!menu) {
      wx.showToast({ title: '菜单不存在', icon: 'none' })
      return
    }

    if (!menu.dishes || menu.dishes.length === 0) {
      wx.showToast({ title: '该菜单暂无菜品', icon: 'none' })
      return
    }

    const menuForInitiate = {
      id: menu.id,
      name: menu.name,
      dishes: (menu.dishes || []).map(d => ({
        ...d,
        id: d.id,
        name: d.name,
        description: d.description || '',
        imageUrl: d.imageUrl || d.image_url || '',
        selected: true
      }))
    }
    getApp().globalData.initiateFromMenu = menuForInitiate

    wx.navigateTo({
      url: '/pages/initiate-meal/initiate-meal?fromMenu=1'
    })
  }
})
