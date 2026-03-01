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
    editingDishName: ''
  },

  onLoad() {
    // 加载菜品数据
    this.loadDishes()
  },

  async loadDishes() {
    try {
      const result = await API.dish.list()
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
      wx.showToast({ title: '请输入菜品名称', icon: 'none' })
      return
    }

    try {
      await API.dish.create(name)
      wx.showToast({ title: '添加成功', icon: 'success' })
      this.setData({
        showAddDialog: false,
        newDishName: ''
      })
      // 重新加载菜品列表
      this.loadDishes()
    } catch (err) {
      console.error('添加菜品失败:', err)
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
      this.setData({ showEditDialog: false })
      // 重新加载菜品列表
      this.loadDishes()
    } catch (err) {
      console.error('更新菜品失败:', err)
    }
  },

  deleteDish(e) {
    const id = e.currentTarget.dataset.id

    wx.showModal({
      title: '确认删除',
      content: '确定要删除这个菜品吗？',
      success: async (res) => {
        if (res.confirm) {
          try {
            await API.dish.delete(id)
            wx.showToast({ title: '删除成功', icon: 'success' })
            // 重新加载菜品列表
            this.loadDishes()
          } catch (err) {
            console.error('删除菜品失败:', err)
          }
        }
      }
    })
  },

  navigateToInitiateMeal() {
    wx.navigateTo({ url: '/pages/initiate-meal/initiate-meal' })
  }
})
