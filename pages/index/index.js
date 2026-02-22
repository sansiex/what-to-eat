// pages/index/index.js
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
  
  loadDishes() {
    const dishes = wx.getStorageSync('dishes') || []
    this.setData({
      dishes,
      filteredDishes: dishes
    })
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
  
  addDish() {
    const name = this.data.newDishName.trim()
    if (!name) {
      wx.showToast({ title: '请输入菜品名称', icon: 'none' })
      return
    }
    
    const dishes = this.data.dishes
    const newId = String(dishes.length + 1)
    const newDish = { id: newId, name }
    
    dishes.push(newDish)
    wx.setStorageSync('dishes', dishes)
    
    this.setData({ 
      dishes,
      filteredDishes: dishes,
      showAddDialog: false,
      newDishName: ''
    })
    
    wx.showToast({ title: '添加成功', icon: 'success' })
  },
  
  updateDish() {
    const name = this.data.editingDishName.trim()
    if (!name) {
      wx.showToast({ title: '请输入菜品名称', icon: 'none' })
      return
    }
    
    const dishes = this.data.dishes
    const index = dishes.findIndex(d => d.id === this.data.editingDishId)
    
    if (index !== -1) {
      dishes[index].name = name
      wx.setStorageSync('dishes', dishes)
      
      this.setData({ 
        dishes,
        filteredDishes: dishes,
        showEditDialog: false
      })
      
      wx.showToast({ title: '更新成功', icon: 'success' })
    }
  },
  
  deleteDish(e) {
    const id = e.currentTarget.dataset.id
    
    wx.showModal({
      title: '确认删除',
      content: '确定要删除这个菜品吗？',
      success: (res) => {
        if (res.confirm) {
          const dishes = this.data.dishes.filter(d => d.id !== id)
          wx.setStorageSync('dishes', dishes)
          
          this.setData({ 
            dishes,
            filteredDishes: dishes
          })
          
          wx.showToast({ title: '删除成功', icon: 'success' })
        }
      }
    })
  },
  
  navigateToInitiateMeal() {
    wx.navigateTo({ url: '/pages/initiate-meal/initiate-meal' })
  }
})