// pages/index/index.js
const { API } = require('../../utils/cloud-api.js')

Page({
  data: {
    dishes: [],
    filteredDishes: [],
    searchKeyword: '',
    showAddDialog: false,
    showEditDialog: false,
    newDishName: '',
    editingDishId: '',
    editingDishName: '',
    // 厨房相关
    kitchens: [],
    currentKitchen: {},
    showKitchenPopup: false,
    showCreateKitchenPopup: false,
    newKitchenName: ''
  },

  onLoad() {
    // 加载厨房数据
    this.loadKitchens()
  },

  onShow() {
    // 页面显示时刷新菜品数据
    if (this.data.currentKitchen.id) {
      this.loadDishes()
    }
  },

  // 加载厨房列表
  async loadKitchens() {
    try {
      const result = await API.kitchen.list()
      const kitchens = result.data.list || []

      // 找到默认厨房或第一个厨房
      const defaultKitchen = kitchens.find(k => k.isDefault) || kitchens[0] || {}

      this.setData({
        kitchens,
        currentKitchen: defaultKitchen
      })

      // 加载当前厨房的菜品
      if (defaultKitchen.id) {
        this.loadDishes()
      }
    } catch (err) {
      console.error('加载厨房失败:', err)
    }
  },

  // 加载菜品数据
  async loadDishes() {
    try {
      const kitchenId = this.data.currentKitchen.id
      const result = await API.dish.list(kitchenId)
      const dishes = result.data.list || []
      this.setData({
        dishes,
        filteredDishes: dishes
      })
    } catch (err) {
      console.error('加载菜品失败:', err)
    }
  },

  // 显示厨房选择器
  showKitchenSelector() {
    this.setData({ showKitchenPopup: true })
  },

  // 隐藏厨房选择器
  hideKitchenSelector() {
    this.setData({ showKitchenPopup: false })
  },

  // 切换厨房
  async switchKitchen(e) {
    const kitchenId = e.currentTarget.dataset.id
    const kitchen = this.data.kitchens.find(k => k.id === kitchenId)

    if (!kitchen) return

    this.setData({
      currentKitchen: kitchen,
      showKitchenPopup: false
    })

    // 重新加载菜品
    await this.loadDishes()

    // 清空搜索
    this.setData({ searchKeyword: '' })
  },

  // 显示创建厨房弹窗
  showCreateKitchenDialog() {
    this.setData({
      showCreateKitchenPopup: true,
      newKitchenName: '',
      showKitchenPopup: false
    })
  },

  // 隐藏创建厨房弹窗
  hideCreateKitchenDialog() {
    this.setData({ showCreateKitchenPopup: false })
  },

  // 厨房名称输入
  onKitchenNameInput(e) {
    this.setData({ newKitchenName: e.detail.value })
  },

  // 创建厨房
  async createKitchen() {
    const name = this.data.newKitchenName.trim()

    if (!name) {
      wx.showToast({ title: '请输入厨房名称', icon: 'none' })
      return
    }

    try {
      const result = await API.kitchen.create(name)
      const newKitchen = result.data

      wx.showToast({ title: '创建成功', icon: 'success' })

      // 更新厨房列表并切换到新厨房
      const kitchens = [...this.data.kitchens, newKitchen]
      this.setData({
        kitchens,
        currentKitchen: newKitchen,
        showCreateKitchenPopup: false
      })

      // 加载新厨房的菜品（空列表）
      this.setData({
        dishes: [],
        filteredDishes: []
      })
    } catch (err) {
      console.error('创建厨房失败:', err)
      wx.showToast({ title: '创建失败', icon: 'none' })
    }
  },

  onSearch(e) {
    const keyword = e.detail.value
    this.setData({ searchKeyword: keyword })
    this.filterDishes(keyword)
  },

  filterDishes(keyword) {
    const dishes = this.data.dishes
    const filteredDishes = dishes.filter(dish =>
      dish.name.toLowerCase().includes(keyword.toLowerCase())
    )
    this.setData({ filteredDishes })
  },

  showAddDialog() {
    this.setData({
      showAddDialog: true,
      newDishName: ''
    })
  },

  hideAddDialog() {
    this.setData({ showAddDialog: false })
  },

  showEditDialog(e) {
    const id = e.currentTarget.dataset.id
    const dish = this.data.dishes.find(d => d.id === id)
    this.setData({
      showEditDialog: true,
      editingDishId: id,
      editingDishName: dish.name
    })
  },

  hideEditDialog() {
    this.setData({ showEditDialog: false })
  },

  onDishNameInput(e) {
    if (this.data.showAddDialog) {
      this.setData({ newDishName: e.detail.value })
    } else if (this.data.showEditDialog) {
      this.setData({ editingDishName: e.detail.value })
    }
  },

  async addDish() {
    const name = this.data.newDishName.trim()
    if (!name) {
      wx.showToast({ title: '请输入菜品名称', icon: 'none' })
      return
    }

    try {
      const kitchenId = this.data.currentKitchen.id
      await API.dish.create(name, kitchenId)
      wx.showToast({ title: '添加成功', icon: 'success' })
      this.hideAddDialog()
      this.loadDishes()
    } catch (err) {
      console.error('添加菜品失败:', err)
      wx.showToast({ title: '添加失败', icon: 'none' })
    }
  },

  async updateDish() {
    const name = this.data.editingDishName.trim()
    if (!name) {
      wx.showToast({ title: '请输入菜品名称', icon: 'none' })
      return
    }

    try {
      await API.dish.update(this.data.editingDishId, name)
      wx.showToast({ title: '更新成功', icon: 'success' })
      this.hideEditDialog()
      this.loadDishes()
    } catch (err) {
      console.error('更新菜品失败:', err)
      wx.showToast({ title: '更新失败', icon: 'none' })
    }
  },

  async deleteDish(e) {
    const id = e.currentTarget.dataset.id

    wx.showModal({
      title: '确认删除',
      content: '确定要删除这个菜品吗？',
      success: async (res) => {
        if (res.confirm) {
          try {
            await API.dish.delete(id)
            wx.showToast({ title: '删除成功', icon: 'success' })
            this.loadDishes()
          } catch (err) {
            console.error('删除菜品失败:', err)
            wx.showToast({ title: '删除失败', icon: 'none' })
          }
        }
      }
    })
  },

  navigateToInitiateMeal() {
    wx.navigateTo({
      url: '/pages/initiate-meal/initiate-meal'
    })
  }
})
