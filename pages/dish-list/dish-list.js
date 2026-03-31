// pages/dish-list/dish-list.js
const { API } = require('../../utils/cloud-api.js')
const { previewSingleDishImage } = require('../../utils/dish-preview.js')
const { uploadDishImage } = require('../../utils/cos-upload.js')

Page({
  data: {
    dishes: [],
    listLoading: true,
    keyword: '',
    showDishDialog: false,
    dialogMode: 'add',
    editingDishId: null,
    dishNameInput: '',
    dishDescriptionInput: '',
    dishImageUrl: '',
    isUploadingImage: false,
    defaultDishImage: '/images/dish-placeholder.png',
    /** 添加菜品弹窗：可选菜单（多选后加入） */
    addDialogMenus: [],
    addDialogHasChecked: false,
    addDialogMenuPickerOpen: false
  },

  onLoad() {
    this.loadDishes()
  },

  onShow() {
    this.loadDishes()
  },

  // 搜索菜品
  onSearch(e) {
    this.setData({ keyword: e.detail.value }, () => {
      this.loadDishes()
    })
  },

  // 显示新增弹窗
  showAddDialog() {
    this.setData({
      showDishDialog: true,
      dialogMode: 'add',
      editingDishId: null,
      dishNameInput: '',
      dishDescriptionInput: '',
      dishImageUrl: '',
      addDialogMenus: [],
      addDialogHasChecked: false,
      addDialogMenuPickerOpen: false
    })
    this.loadMenusForAddDialog()
  },

  async loadMenusForAddDialog() {
    const currentKitchen = getApp().globalData.currentKitchen
    if (!currentKitchen || currentKitchen.id == null) {
      this.setData({
        addDialogMenus: [],
        addDialogHasChecked: false,
        addDialogMenuPickerOpen: false
      })
      return
    }
    try {
      const res = await API.menu.list(currentKitchen.id)
      const list = (res.data && res.data.list) || []
      this.setData({
        addDialogMenus: list.map((m) => ({
          id: m.id,
          name: m.name || '未命名菜单',
          checked: false
        })),
        addDialogHasChecked: false,
        addDialogMenuPickerOpen: false
      })
    } catch (e) {
      console.warn('加载菜单列表失败', e)
      this.setData({
        addDialogMenus: [],
        addDialogHasChecked: false,
        addDialogMenuPickerOpen: false
      })
    }
  },

  toggleAddDialogMenuPicker() {
    if (!(this.data.addDialogMenus || []).length) return
    this.setData({
      addDialogMenuPickerOpen: !this.data.addDialogMenuPickerOpen
    })
  },

  noopAddDialogMenu() {},

  toggleAddDialogMenu(e) {
    const id = Number(e.currentTarget.dataset.id)
    if (!id) return
    const addDialogMenus = (this.data.addDialogMenus || []).map((m) =>
      m.id === id ? { ...m, checked: !m.checked } : m
    )
    this.setData({
      addDialogMenus,
      addDialogHasChecked: addDialogMenus.some((m) => m.checked)
    })
  },

  uncheckAddDialogMenu(e) {
    const id = Number(e.currentTarget.dataset.id)
    if (!id) return
    const addDialogMenus = (this.data.addDialogMenus || []).map((m) =>
      m.id === id ? { ...m, checked: false } : m
    )
    this.setData({
      addDialogMenus,
      addDialogHasChecked: addDialogMenus.some((m) => m.checked)
    })
  },

  // 显示编辑弹窗
  showEditDialog(e) {
    const dishId = e.currentTarget.dataset.id
    const dish = this.data.dishes.find(d => d.id === dishId)
    if (!dish) {
      wx.showToast({ title: '菜品不存在', icon: 'none' })
      return
    }

    this.setData({
      showDishDialog: true,
      dialogMode: 'edit',
      editingDishId: dishId,
      dishNameInput: dish.name || '',
      dishDescriptionInput: dish.description || '',
      dishImageUrl: dish.imageUrl || '',
      addDialogMenus: [],
      addDialogHasChecked: false,
      addDialogMenuPickerOpen: false
    })
  },

  // 隐藏弹窗
  hideDishDialog() {
    this.setData({
      showDishDialog: false,
      dialogMode: 'add',
      editingDishId: null,
      dishNameInput: '',
      dishDescriptionInput: '',
      dishImageUrl: '',
      addDialogMenus: [],
      addDialogHasChecked: false,
      addDialogMenuPickerOpen: false
    })
  },

  // 输入菜品名称
  onDishNameInput(e) {
    this.setData({ dishNameInput: e.detail.value })
  },

  // 输入菜品描述
  onDishDescInput(e) {
    this.setData({ dishDescriptionInput: e.detail.value })
  },

  // 选择并上传菜品图片（上传到云存储/COS）
  chooseDishImage() {
    wx.chooseMedia({
      count: 1,
      mediaType: ['image'],
      sizeType: ['compressed'],
      sourceType: ['album', 'camera'],
      success: async (res) => {
        const file = res.tempFiles && res.tempFiles[0]
        if (!file || !file.tempFilePath) return

        // 2MB 限制，避免上传过大图片
        if (file.size && file.size > 2 * 1024 * 1024) {
          wx.showToast({ title: '图片不能超过2MB', icon: 'none' })
          return
        }

        try {
          this.setData({ isUploadingImage: true })
          const uploadResult = await uploadDishImage(file.tempFilePath)
          this.setData({ dishImageUrl: uploadResult.fileID })
          wx.showToast({ title: '上传成功', icon: 'success' })
        } catch (err) {
          console.error('上传菜品图片失败:', err)
          wx.showToast({ title: '上传失败', icon: 'none' })
        } finally {
          this.setData({ isUploadingImage: false })
        }
      }
    })
  },

  removeDishImage() {
    this.setData({ dishImageUrl: '' })
  },

  // 保存菜品（新增/编辑）
  async submitDish() {
    const { dialogMode, editingDishId, dishNameInput, dishDescriptionInput, dishImageUrl } = this.data
    const trimmedName = (dishNameInput || '').trim()
    const trimmedDescription = (dishDescriptionInput || '').trim()

    if (!trimmedName) {
      wx.showToast({ title: '请输入菜品名称', icon: 'none' })
      return
    }

    if (trimmedName.length > 30) {
      wx.showToast({ title: '菜品名称最多30字', icon: 'none' })
      return
    }

    if (trimmedDescription.length > 80) {
      wx.showToast({ title: '描述最多80字', icon: 'none' })
      return
    }

    const duplicate = this.data.dishes.find(d =>
      d.name === trimmedName && d.id !== editingDishId
    )
    if (duplicate) {
      wx.showToast({ title: '该菜品名称已存在', icon: 'none' })
      return
    }

    try {
      if (dialogMode === 'edit' && editingDishId) {
        await API.dish.update(editingDishId, trimmedName, trimmedDescription, dishImageUrl)
        wx.showToast({ title: '更新成功', icon: 'success' })
      } else {
        const currentKitchen = getApp().globalData.currentKitchen
        const kitchenId = currentKitchen && currentKitchen.id != null ? currentKitchen.id : null
        const createResult = await API.dish.create(
          trimmedName,
          trimmedDescription,
          dishImageUrl,
          kitchenId
        )
        const newDishId = createResult.data && createResult.data.id
        const newDishIdNum = newDishId != null ? Number(newDishId) : null
        const selectedMenus = (this.data.addDialogMenus || []).filter((m) => m.checked)
        if (newDishIdNum && selectedMenus.length > 0) {
          wx.showLoading({ title: '加入菜单…', mask: true })
          try {
            for (const m of selectedMenus) {
              const g = await API.menu.get(m.id)
              const menu = g.data
              if (!menu) continue
              const ids = (menu.dishes || []).map((d) => Number(d.id))
              if (ids.includes(newDishIdNum)) continue
              await API.menu.update({
                id: m.id,
                name: menu.name,
                dishIds: [...ids, newDishIdNum]
              })
            }
          } catch (joinErr) {
            console.error('加入菜单失败', joinErr)
            wx.hideLoading()
            wx.showToast({
              title: '菜品已创建，部分菜单未更新',
              icon: 'none',
              duration: 2500
            })
            this.hideDishDialog()
            this.loadDishes()
            return
          }
          wx.hideLoading()
        }
        wx.showToast({ title: '添加成功', icon: 'success' })
      }
      this.hideDishDialog()
      this.loadDishes()
    } catch (err) {
      console.error('保存菜品失败:', err)
      wx.hideLoading()
      wx.showToast({ title: '保存失败', icon: 'none' })
    }
  },

  deleteDish() {
    const { editingDishId, dishNameInput } = this.data
    if (!editingDishId) return

    wx.showModal({
      title: '确认删除',
      content: `确定要删除"${dishNameInput}"吗？`,
      success: async (res) => {
        if (res.confirm) {
          try {
            await API.dish.delete(editingDishId)
            wx.showToast({ title: '删除成功', icon: 'success' })
            this.hideDishDialog()
            this.loadDishes()
          } catch (err) {
            console.error('删除菜品失败:', err)
            wx.showToast({ title: '删除失败', icon: 'none' })
          }
        }
      }
    })
  },

  previewDishImage(e) {
    previewSingleDishImage(e.currentTarget.dataset.url)
  },

  // 统一补全展示字段
  normalizeDish(dish) {
    const defaultDishImage = this.data.defaultDishImage
    const imageUrl = dish.imageUrl || dish.image_url || ''
    return {
      ...dish,
      imageUrl,
      displayImage: imageUrl || defaultDishImage,
      displayDescription: dish.description || '暂无描述'
    }
  },

  async loadDishes() {
    this.setData({ listLoading: true })
    try {
      const { keyword } = this.data
      const currentKitchen = getApp().globalData.currentKitchen
      const kitchenId = currentKitchen ? currentKitchen.id : null
      const result = await API.dish.list(kitchenId, keyword)
      const rawList = result.data.list || []
      console.log('[loadDishes] raw list from API:', JSON.stringify(rawList.map(d => ({ id: d.id, name: d.name, image_url: d.image_url, imageUrl: d.imageUrl }))))
      const dishes = rawList.map(d => this.normalizeDish(d))
      this.setData({ dishes, listLoading: false })
    } catch (err) {
      console.error('加载菜品失败:', err)
      this.setData({ listLoading: false })
      wx.showToast({ title: '加载失败', icon: 'none' })
    }
  }
})
