// pages/menu-edit/menu-edit.js
const { API } = require('../../utils/cloud-api.js')
const { uploadDishImage } = require('../../utils/cos-upload.js')
const { previewSingleDishImage } = require('../../utils/dish-preview.js')

/** 与后端/缓存中的 id 类型统一，避免 number 与 string 导致 includes 失败 */
function normalizeDishId(id) {
  const n = Number(id)
  return Number.isNaN(n) ? id : n
}

Page({
  data: {
    isEditMode: false,
    menuName: '',
    allDishes: [],
    filteredDishes: [],
    /** 当前筛选列表是否已全部勾选（全选/全不选） */
    listAllSelected: false,
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
      selectedDishIds: (menu.dishes || []).map(d => normalizeDishId(d.id))
    })

    this.loadAllDishes()
  },

  // 加载所有菜品
  async loadAllDishes() {
    try {
      // 必须与菜单列表使用同一厨房，否则拉错菜品库
      const currentKitchen = getApp().globalData.currentKitchen
      const kitchenIdForDishes =
        currentKitchen && currentKitchen.id != null ? currentKitchen.id : null
      const result = await API.dish.list(kitchenIdForDishes, '')
      const dishes = result.data.list || []
      console.log(
        '[loadAllDishes] kitchenId:',
        kitchenIdForDishes,
        'raw list:',
        JSON.stringify(dishes.map(d => ({ id: d.id, name: d.name, image_url: d.image_url, imageUrl: d.imageUrl })))
      )
      const { selectedDishIds } = this.data
      const defaultDishImage = this.data.defaultDishImage
      const selectedSet = new Set(selectedDishIds.map(id => normalizeDishId(id)))

      // 为每个菜品添加 selected 属性
      const dishesWithSelected = dishes.map(dish => {
        const imageUrl = dish.imageUrl || dish.image_url || ''
        const nid = normalizeDishId(dish.id)
        const selected = selectedSet.has(nid)
        return {
          ...dish,
          id: nid,
          selected,
          imageUrl,
          displayImage: imageUrl || defaultDishImage,
          displayDescription: dish.description || '暂无描述'
        }
      })
      this.setData({
        allDishes: dishesWithSelected,
        filteredDishes: dishesWithSelected,
        listAllSelected:
          dishesWithSelected.length > 0 && dishesWithSelected.every(d => d.selected)
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

  _applySelection(newSelectedIds) {
    const { allDishes } = this.data
    const kw = (this.data.searchKeyword || '').toLowerCase()
    const sel = new Set(newSelectedIds.map(id => normalizeDishId(id)))
    const updatedAll = allDishes.map(dish => ({
      ...dish,
      selected: sel.has(normalizeDishId(dish.id))
    }))
    const filtered = updatedAll.filter(dish => dish.name.toLowerCase().includes(kw))
    this.setData({
      allDishes: updatedAll,
      filteredDishes: filtered,
      selectedDishIds: newSelectedIds,
      listAllSelected: filtered.length > 0 && filtered.every(d => d.selected)
    })
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
      filteredDishes: filtered,
      listAllSelected: filtered.length > 0 && filtered.every(d => d.selected)
    })
  },

  // 切换菜品选择（只更新勾选状态，不移动菜品）
  toggleDishSelection(e) {
    const dishId = normalizeDishId(e.currentTarget.dataset.id)
    const { selectedDishIds } = this.data

    const isSelected = selectedDishIds.some(id => normalizeDishId(id) === dishId)
    const newSelectedIds = isSelected
      ? selectedDishIds.filter(id => normalizeDishId(id) !== dishId)
      : [...selectedDishIds, dishId]

    this._applySelection(newSelectedIds)
  },

  // 当前筛选列表全选 / 全不选
  toggleSelectAllFiltered() {
    const { filteredDishes, selectedDishIds } = this.data
    if (filteredDishes.length === 0) return
    const allSelected = filteredDishes.every(d => d.selected)
    const filteredIdSet = new Set(filteredDishes.map(d => normalizeDishId(d.id)))
    if (allSelected) {
      this._applySelection(
        selectedDishIds.filter(id => !filteredIdSet.has(normalizeDishId(id)))
      )
    } else {
      const idsToAdd = [...filteredIdSet]
      this._applySelection([...new Set([...selectedDishIds, ...idsToAdd])])
    }
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
      
      const currentKitchen = getApp().globalData.currentKitchen
      const kitchenId =
        currentKitchen && currentKitchen.id != null ? currentKitchen.id : null
      const result = await API.dish.create(
        newDishName.trim(),
        newDishDescription.trim(),
        newDishImageUrl,
        kitchenId
      )
      const newDish = result.data
      
      wx.hideLoading()
      
      // 添加到列表并选中（优先使用本地已知的图片URL，再回退到后端返回值）
      const { allDishes, selectedDishIds, defaultDishImage } = this.data
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
      
      const newAllDishes = [...allDishes, dishWithSelected]
      const kw = (this.data.searchKeyword || '').toLowerCase()
      const newFilteredDishes = newAllDishes.filter(d => d.name.toLowerCase().includes(kw))
      const newSelectedIds = [...selectedDishIds, newDish.id]
      this.setData({
        allDishes: newAllDishes,
        filteredDishes: newFilteredDishes,
        selectedDishIds: newSelectedIds,
        showAddDishDialog: false,
        newDishName: '',
        newDishDescription: '',
        newDishImageUrl: '',
        listAllSelected:
          newFilteredDishes.length > 0 && newFilteredDishes.every(d => d.selected)
      })
      
      wx.showToast({ title: '添加成功', icon: 'success' })
    } catch (err) {
      wx.hideLoading()
      console.error('添加菜品失败:', err)
      wx.showToast({ title: '添加失败', icon: 'none' })
    }
  },

  previewDishImage(e) {
    previewSingleDishImage(e.currentTarget.dataset.url)
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
  },

  async saveAndInitiate() {
    const { isEditMode, menuName, selectedDishIds, allDishes } = this.data

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

    let currentKitchen = getApp().globalData.currentKitchen
    if (!currentKitchen) {
      await getApp().initDefaultKitchen()
      currentKitchen = getApp().globalData.currentKitchen
    }
    if (!currentKitchen) {
      wx.showToast({ title: '请先选择厨房', icon: 'none' })
      return
    }

    try {
      wx.showLoading({ title: '保存中...' })

      if (isEditMode) {
        const menu = getApp().globalData.currentMenu
        await API.menu.update({
          id: menu.id,
          name: menuName.trim(),
          dishIds: selectedDishIds
        })
      } else {
        await API.menu.create({
          name: menuName.trim(),
          dishIds: selectedDishIds,
          kitchenId: currentKitchen.id
        })
      }

      wx.hideLoading()

      // 获取保存后的菜单数据（含菜品详情）
      const dishesForMenu = allDishes.filter(d => selectedDishIds.includes(d.id))
      const menuForInitiate = {
        name: menuName.trim(),
        dishes: dishesForMenu.map(d => ({
          id: d.id,
          name: d.name,
          description: d.description,
          imageUrl: d.imageUrl || d.image_url,
          selected: true
        }))
      }
      if (isEditMode && currentMenu) {
        menuForInitiate.id = currentMenu.id
      } else {
        // 新建菜单需从列表取最新
        const listRes = await API.menu.list(currentKitchen.id)
        const list = listRes.data.list || []
        const saved = list.find(m => m.name === menuName.trim())
        if (saved) menuForInitiate.id = saved.id
      }

      getApp().globalData.initiateFromMenu = menuForInitiate

      wx.navigateTo({
        url: '/pages/initiate-meal/initiate-meal?fromMenu=1'
      })
      wx.showToast({ title: '保存成功', icon: 'success' })
    } catch (err) {
      wx.hideLoading()
      console.error('保存菜单失败:', err)
      wx.showToast({ title: '保存失败', icon: 'none' })
    }
  }
})
