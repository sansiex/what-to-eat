// pages/dish-list/dish-list.js
const { API } = require('../../utils/cloud-api.js')

Page({
  data: {
    dishes: [],
    keyword: '',
    showAddDialog: false,
    newDishName: '',
    newDishDescription: ''
  },

  onLoad() {
    this.loadDishes()
  },

  onShow() {
    this.loadDishes()
  },

  // 加载菜品列表
  async loadDishes() {
    try {
      const { keyword } = this.data
      const result = await API.dish.list(null, keyword)
      this.setData({ dishes: result.data.list || [] })
    } catch (err) {
      console.error('加载菜品失败:', err)
      wx.showToast({ title: '加载失败', icon: 'none' })
    }
  },

  // 搜索菜品
  onSearch(e) {
    this.setData({ keyword: e.detail.value }, () => {
      this.loadDishes()
    })
  },

  // 显示添加弹窗
  showAddDialog() {
    this.setData({
      showAddDialog: true,
      newDishName: '',
      newDishDescription: ''
    })
  },

  // 隐藏添加弹窗
  hideAddDialog() {
    this.setData({
      showAddDialog: false,
      newDishName: '',
      newDishDescription: ''
    })
  },

  // 输入菜品名称
  onDishNameInput(e) {
    this.setData({ newDishName: e.detail.value })
  },

  // 输入菜品描述
  onDishDescInput(e) {
    this.setData({ newDishDescription: e.detail.value })
  },

  // 添加菜品
  async addDish() {
    const { newDishName, newDishDescription } = this.data

    if (!newDishName.trim()) {
      wx.showToast({ title: '请输入菜品名称', icon: 'none' })
      return
    }

    try {
      await API.dish.create(newDishName.trim(), newDishDescription.trim())
      wx.showToast({ title: '添加成功', icon: 'success' })
      this.hideAddDialog()
      this.loadDishes()
    } catch (err) {
      console.error('添加菜品失败:', err)
      wx.showToast({ title: '添加失败', icon: 'none' })
    }
  },

  // 删除菜品
  deleteDish(e) {
    const dishId = e.currentTarget.dataset.id
    const dishName = e.currentTarget.dataset.name

    wx.showModal({
      title: '确认删除',
      content: `确定要删除"${dishName}"吗？`,
      success: async (res) => {
        if (res.confirm) {
          try {
            await API.dish.delete(dishId)
            wx.showToast({ title: '删除成功', icon: 'success' })
            this.loadDishes()
          } catch (err) {
            console.error('删除菜品失败:', err)
            wx.showToast({ title: '删除失败', icon: 'none' })
          }
        }
      }
    })
  }
})
