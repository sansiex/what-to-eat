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
    currentKitchen: null
  },

  onLoad() {
    // 加载厨房和菜品数据
    this.loadKitchenAndDishes()
  },

  onShow() {
    // 页面显示时刷新菜品数据
    if (this.data.currentKitchen) {
      this.loadDishes()
    }
  },

  // 加载厨房和菜品数据
  async loadKitchenAndDishes() {
    try {
      // 获取当前用户的厨房列表
      const result = await API.kitchen.list()
      const kitchens = result.data.list || []
      
      let kitchen = null
      
      if (kitchens.length === 0) {
        // 用户没有厨房，自动创建默认厨房
        const createResult = await API.kitchen.create('我的厨房')
        kitchen = createResult.data
      } else {
        // 使用默认厨房或第一个厨房
        kitchen = kitchens.find(k => k.isDefault) || kitchens[0]
      }
      
      this.setData({
        currentKitchen: kitchen
      })
      
      // 加载该厨房的菜品
      this.loadDishes()
    } catch (err) {
      console.error('加载厨房失败:', err)
    }
  },

  // 加载菜品数据
  async loadDishes() {
    try {
      const kitchen = this.data.currentKitchen
      if (!kitchen) {
        console.error('没有当前厨房信息')
        return
      }
      
      console.log('加载菜品，kitchenId:', kitchen.id)
      const result = await API.dish.list(kitchen.id)
      console.log('菜品加载结果:', result)
      const dishes = result.data.list || []
      this.setData({
        dishes,
        filteredDishes: dishes
      })
    } catch (err) {
      console.error('加载菜品失败:', err)
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
      wx.showToast({
        title: '请输入菜品名称',
        icon: 'none'
      })
      return
    }

    try {
      await API.dish.create(name)
      wx.showToast({
        title: '添加成功',
        icon: 'success'
      })
      this.hideAddDialog()
      this.loadDishes()
    } catch (err) {
      console.error('添加菜品失败:', err)
      wx.showToast({
        title: '添加失败',
        icon: 'none'
      })
    }
  },

  async updateDish() {
    const name = this.data.editingDishName.trim()

    if (!name) {
      wx.showToast({
        title: '请输入菜品名称',
        icon: 'none'
      })
      return
    }

    try {
      await API.dish.update(this.data.editingDishId, name)
      wx.showToast({
        title: '更新成功',
        icon: 'success'
      })
      this.hideEditDialog()
      this.loadDishes()
    } catch (err) {
      console.error('更新菜品失败:', err)
      wx.showToast({
        title: '更新失败',
        icon: 'none'
      })
    }
  },

  async deleteDish(e) {
    const id = e.currentTarget.dataset.id

    try {
      await API.dish.delete(id)
      wx.showToast({
        title: '删除成功',
        icon: 'success'
      })
      this.loadDishes()
    } catch (err) {
      console.error('删除菜品失败:', err)
      wx.showToast({
        title: '删除失败',
        icon: 'none'
      })
    }
  },

  navigateToInitiateMeal() {
    wx.navigateTo({
      url: '/pages/initiate-meal/initiate-meal'
    })
  }
})
