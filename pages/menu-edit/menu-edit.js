// pages/menu-edit/menu-edit.js
const { API } = require('../../utils/cloud-api.js')
const { uploadDishImage } = require('../../utils/cos-upload.js')

Page({
  data: {
    isEditMode: false,
    menuName: '',
    allDishes: [],
    filteredDishes: [],
    selectedDishIds: [],
    searchKeyword: '',
    showAddDishDialog: false,
    newDishName: '',
    newDishDescription: '',
    newDishImageUrl: '',
    isUploadingImage: false,
    defaultDishImage: '/images/dish-placeholder.png'
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
      console.log('[loadAllDishes] raw list from API:', JSON.stringify(dishes.map(d => ({ id: d.id, name: d.name, image_url: d.image_url, imageUrl: d.imageUrl }))))
      const { selectedDishIds } = this.data
      const defaultDishImage = this.data.defaultDishImage
      
      // 为每个菜品添加 selected 属性
      const dishesWithSelected = dishes.map(dish => {
        const imageUrl = dish.imageUrl || dish.image_url || ''
        return {
          ...dish,
          selected: selectedDishIds.includes(dish.id),
          imageUrl,
          displayImage: imageUrl || defaultDishImage,
          displayDescription: dish.description || '暂无描述'
        }
      })
      
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

  // 点击快捷标签
  onQuickTagTap(e) {
    const tag = e.currentTarget.dataset.tag
    this.setData({ menuName: tag })
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
      newDishName: '',
      newDishDescription: '',
      newDishImageUrl: ''
    })
  },

  // 隐藏新增菜品弹窗
  hideAddDishDialog() {
    this.setData({
      showAddDishDialog: false,
      newDishName: '',
      newDishDescription: '',
      newDishImageUrl: ''
    })
  },

  // 输入新菜品名称
  onNewDishNameInput(e) {
    this.setData({ newDishName: e.detail.value })
  },

  onNewDishDescriptionInput(e) {
    this.setData({ newDishDescription: e.detail.value })
  },

  chooseNewDishImage() {
    wx.chooseMedia({
      count: 1,
      mediaType: ['image'],
      sizeType: ['compressed'],
      sourceType: ['album', 'camera'],
      success: async (res) => {
        const file = res.tempFiles && res.tempFiles[0]
        if (!file || !file.tempFilePath) return
        if (file.size && file.size > 2 * 1024 * 1024) {
          wx.showToast({ title: '图片不能超过2MB', icon: 'none' })
          return
        }

        try {
          this.setData({ isUploadingImage: true })
          const uploadResult = await uploadDishImage(file.tempFilePath)
          this.setData({ newDishImageUrl: uploadResult.fileID })
          wx.showToast({ title: '上传成功', icon: 'success' })
        } catch (err) {
          console.error('上传图片失败:', err)
          wx.showToast({ title: '上传失败', icon: 'none' })
        } finally {
          this.setData({ isUploadingImage: false })
        }
      }
    })
  },

  removeNewDishImage() {
    this.setData({ newDishImageUrl: '' })
  },

  // 确认添加菜品
  async confirmAddDish() {
    const { newDishName, newDishDescription, newDishImageUrl } = this.data
    
    if (!newDishName.trim()) {
      wx.showToast({ title: '请输入菜品名称', icon: 'none' })
      return
    }

    if (newDishDescription.trim().length > 80) {
      wx.showToast({ title: '描述最多80字', icon: 'none' })
      return
    }

    const duplicate = this.data.allDishes.find(d => d.name === newDishName.trim())
    if (duplicate) {
      wx.showToast({ title: '该菜品名称已存在', icon: 'none' })
      return
    }

    try {
      wx.showLoading({ title: '添加中...' })
      
      // 创建菜品
      const result = await API.dish.create(newDishName.trim(), newDishDescription.trim(), newDishImageUrl)
      const newDish = result.data
      
      wx.hideLoading()
      
      // 添加到列表并选中（优先使用本地已知的图片URL，再回退到后端返回值）
      const { allDishes, filteredDishes, selectedDishIds, defaultDishImage } = this.data
      const imageUrl = newDishImageUrl || newDish.imageUrl || newDish.image_url || ''
      console.log('[confirmAddDish] imageUrl resolved:', imageUrl, '| newDishImageUrl:', newDishImageUrl, '| backend:', newDish.image_url, newDish.imageUrl)
      const dishWithSelected = {
        ...newDish,
        selected: true,
        description: newDishDescription.trim() || newDish.description || '',
        imageUrl,
        displayImage: imageUrl || defaultDishImage,
        displayDescription: newDishDescription.trim() || newDish.description || '暂无描述'
      }
      
      this.setData({
        allDishes: [...allDishes, dishWithSelected],
        filteredDishes: [...filteredDishes, dishWithSelected],
        selectedDishIds: [...selectedDishIds, newDish.id],
        showAddDishDialog: false,
        newDishName: '',
        newDishDescription: '',
        newDishImageUrl: ''
      })
      
      wx.showToast({ title: '添加成功', icon: 'success' })
    } catch (err) {
      wx.hideLoading()
      console.error('添加菜品失败:', err)
      wx.showToast({ title: '添加失败', icon: 'none' })
    }
  },

  previewDishImage(e) {
    var url = e.currentTarget.dataset.url
    if (!url) return
    wx.previewImage({ current: url, urls: [url] })
  },

  deleteMenu() {
    const menu = getApp().globalData.currentMenu
    if (!menu) return

    wx.showModal({
      title: '确认删除',
      content: `确定要删除"${menu.name}"吗？`,
      success: async (res) => {
        if (res.confirm) {
          try {
            await API.menu.delete(menu.id)
            wx.showToast({ title: '删除成功', icon: 'success' })
            wx.navigateBack()
          } catch (err) {
            console.error('删除菜单失败:', err)
            wx.showToast({ title: '删除失败', icon: 'none' })
          }
        }
      }
    })
  },

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

    const currentMenu = getApp().globalData.currentMenu
    const existingMenus = getApp().globalData._menuListCache || []
    const duplicate = existingMenus.find(m =>
      m.name === menuName.trim() && (!isEditMode || m.id !== (currentMenu && currentMenu.id))
    )
    if (duplicate) {
      wx.showToast({ title: '该菜单名称已存在', icon: 'none' })
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
