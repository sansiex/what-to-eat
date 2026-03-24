// pages/initiate-meal/initiate-meal.js
const { API } = require('../../utils/cloud-api.js')
const { requestMealOrderNotifySubscribe } = require('../../utils/subscribe-meal-order-notify.js')
const { previewSingleDishImage } = require('../../utils/dish-preview.js')
const {
  buildMealDatePickerOptions,
  buildMealTimeMultiRange,
  getBeijingNowRoundedTo5Min,
  getSuggestedTimePickerIndicesForMealName,
  formatMealTimeDisplay,
  parseScheduledAtFromApi
} = require('../../utils/beijing-meal-schedule.js')

/** multiSelector 的 value 必须在各列范围内，否则 iOS 上滚轮空白 */
function clampMealTimePickerValue(pair, timeRange) {
  const hCol = (timeRange && timeRange[0]) || []
  const mCol = (timeRange && timeRange[1]) || []
  const hMax = Math.max(0, hCol.length - 1)
  const mMax = Math.max(0, mCol.length - 1)
  let h = Number(pair[0])
  let m = Number(pair[1])
  if (Number.isNaN(h)) h = 0
  if (Number.isNaN(m)) m = 0
  return [Math.min(hMax, Math.max(0, h)), Math.min(mMax, Math.max(0, m))]
}

/**
 * iOS 上 picker 首屏若 range 为空或与 value 不匹配会整段空白；
 * 必须在首次渲染前就有完整的 range 与合法 value（与 initMealSchedulePickers 逻辑一致）。
 */
function createDefaultMealSchedulePickerData() {
  const { labels, values } = buildMealDatePickerOptions(28)
  const timeRange = buildMealTimeMultiRange()
  const nowR = getBeijingNowRoundedTo5Min()
  const mealTimePickerValue = clampMealTimePickerValue(
    [nowR.hourIndex, nowR.minuteIndex],
    timeRange
  )
  return {
    mealDateLabels: labels,
    mealDateValues: values,
    mealDateIndex: 0,
    mealDateDisplay: labels[0] || '请选择日期',
    mealTimeRange: timeRange,
    mealTimePickerValue,
    mealTimeSpecified: false,
    mealTimeDisplay: '未选择（非必填）'
  }
}

Page({
  data: {
    selectedMealName: '',
    fromMenuMode: false,
    dishes: [],
    selectedDishes: [],
    selectAll: true,
    isEditMode: false,
    editingMealId: '',
    defaultDishImage: '/images/dish-placeholder.png',
    ...createDefaultMealSchedulePickerData()
  },

  onLoad(options) {
    // 检查是否是编辑模式
    if (options && options.mode === 'edit') {
      wx.setNavigationBarTitle({ title: '编辑点餐' })
      this.setData({ isEditMode: true })
      this.loadEditingMeal()
    } else if (options && options.fromMenu === '1') {
      // 从菜单编辑页「保存并发起点餐」进入
      this.loadFromMenu()
    } else {
      this.initMealSchedulePickers(null)
      this.loadDishes()
    }
  },

  onShow() {
    // 页面显示时重新加载菜品数据，确保获取最新数据
    if (!this.data.isEditMode && !this.data.fromMenuMode) {
      this.loadDishes()
    }
  },

  onReady() {
    this.refreshPickerBindDataForIOS()
  },

  /**
   * iOS：picker 偶发需首屏后重新 setData 一份 range/value（新数组引用）才能显示选项；
   * 且不应把 picker 放在 scroll-view 内（见 wxml 结构）。
   */
  refreshPickerBindDataForIOS() {
    const d = this.data
    if (!d.mealDateLabels || d.mealDateLabels.length === 0) return
    const tr0 = d.mealTimeRange && d.mealTimeRange[0]
    const tr1 = d.mealTimeRange && d.mealTimeRange[1]
    wx.nextTick(() => {
      this.setData({
        mealDateLabels: [...d.mealDateLabels],
        mealDateValues: [...(d.mealDateValues || [])],
        mealTimeRange: [tr0 ? [...tr0] : [], tr1 ? [...tr1] : []],
        mealDateIndex: Number(d.mealDateIndex) || 0,
        mealTimePickerValue: [
          Number(d.mealTimePickerValue[0]) || 0,
          Number(d.mealTimePickerValue[1]) || 0
        ]
      })
    })
  },

  /** 编辑模式下用户用左上角返回时清理全局编辑态（原底部「返回」按钮逻辑） */
  onUnload() {
    if (this.data.isEditMode) {
      getApp().globalData.editingMeal = null
    }
  },

  // 从菜单加载（保存并发起点餐）
  loadFromMenu() {
    const menu = getApp().globalData.initiateFromMenu
    if (!menu || !menu.dishes || menu.dishes.length === 0) {
      wx.showToast({ title: '没有可用的菜单数据', icon: 'none' })
      wx.navigateBack()
      return
    }
    const defaultDishImage = this.data.defaultDishImage
    const dishesWithSelected = menu.dishes.map(d => ({
      ...d,
      selected: true,
      imageUrl: d.imageUrl || d.image_url || '',
      displayImage: (d.imageUrl || d.image_url) || defaultDishImage,
      displayDescription: d.description || '暂无描述'
    }))
    const selectedDishes = dishesWithSelected.map(d => d.id)
    this.setData({
      fromMenuMode: true,
      selectedMealName: menu.name,
      dishes: dishesWithSelected,
      selectedDishes,
      selectAll: true
    })
    this.initMealSchedulePickers(null, menu.name)
    getApp().globalData.initiateFromMenu = null
  },

  // 加载正在编辑的餐食数据
  async loadEditingMeal() {
    const editingMeal = getApp().globalData.editingMeal
    if (!editingMeal) {
      wx.showToast({ title: '没有要编辑的点餐', icon: 'none' })
      wx.navigateBack()
      return
    }

    console.log('加载编辑的餐食数据:', editingMeal)

    try {
      const currentKitchen = getApp().globalData.currentKitchen
      const kitchenId =
        currentKitchen && currentKitchen.id != null ? Number(currentKitchen.id) : null
      const result = await API.dish.list(kitchenId, '')
      const allDishes = result.data.list || []

      // 构建菜品选择状态
      const mealDishIds = editingMeal.dishes.map(d => Number(d.id))
      const defaultDishImage = this.data.defaultDishImage
      const dishesWithSelected = allDishes.map(dish => ({
        ...dish,
        selected: mealDishIds.includes(Number(dish.id)),
        imageUrl: dish.imageUrl || dish.image_url || '',
        displayImage: (dish.imageUrl || dish.image_url) || defaultDishImage,
        displayDescription: dish.description || '暂无描述'
      }))

      const selectedDishes = dishesWithSelected.filter(d => d.selected).map(d => d.id)

      this.setData({
        editingMealId: editingMeal.id,
        selectedMealName: editingMeal.name,
        dishes: dishesWithSelected,
        selectedDishes,
        selectAll: selectedDishes.length === allDishes.length && allDishes.length > 0
      })
      this.initMealSchedulePickers(editingMeal)
    } catch (err) {
      console.error('加载编辑数据失败:', err)
      wx.showToast({ title: '加载失败', icon: 'none' })
    }
  },

  async loadDishes() {
    try {
      const currentKitchen = getApp().globalData.currentKitchen
      const kitchenId =
        currentKitchen && currentKitchen.id != null ? Number(currentKitchen.id) : null
      const result = await API.dish.list(kitchenId, '')
      const dishes = result.data.list || []
      console.log('加载的菜品数据:', dishes)

      // 确保selectedDishes数组包含所有菜品的ID
      const selectedDishes = dishes.map(dish => dish.id)
      console.log('默认选中的菜品ID:', selectedDishes)

      // 为每个菜品添加一个selected属性
      const defaultDishImage = this.data.defaultDishImage
      const dishesWithSelected = dishes.map(dish => ({
        ...dish,
        selected: true, // 默认全选
        imageUrl: dish.imageUrl || dish.image_url || '',
        displayImage: (dish.imageUrl || dish.image_url) || defaultDishImage,
        displayDescription: dish.description || '暂无描述'
      }))

      this.setData({
        dishes: dishesWithSelected,
        selectedDishes,
        selectAll: selectedDishes.length > 0
      }, () => {
        // 数据更新完成后的回调
        console.log('数据更新完成，selectedDishes:', this.data.selectedDishes)
        console.log('数据更新完成，selectAll:', this.data.selectAll)
        console.log('数据更新完成，dishes:', this.data.dishes)
      })
    } catch (err) {
      console.error('加载菜品失败:', err)
    }
  },

  onMealNameInput(e) {
    const selectedMealName = e.detail.value
    const patch = { selectedMealName }
    if (!this.data.mealTimeSpecified) {
      const suggested = getSuggestedTimePickerIndicesForMealName(selectedMealName)
      const nowR = getBeijingNowRoundedTo5Min()
      patch.mealTimePickerValue = suggested
        ? [suggested.hourIndex, suggested.minuteIndex]
        : [nowR.hourIndex, nowR.minuteIndex]
    }
    this.setData(patch)
  },

  /**
   * @param {object|null} meal 编辑时带入 API 返回的 scheduledAt / scheduledTimeSpecified
   * @param {string} [mealNameHint] 餐名（用于 setData 异步后仍能按菜单名推断默认时刻）
   */
  initMealSchedulePickers(meal, mealNameHint) {
    const { labels, values } = buildMealDatePickerOptions(28)
    const timeRange = buildMealTimeMultiRange()
    const nowR = getBeijingNowRoundedTo5Min()
    let mealDateIndex = 0
    let mealTimeSpecified = false
    let mealTimePickerValue = [nowR.hourIndex, nowR.minuteIndex]

    const nameForHint =
      mealNameHint != null && String(mealNameHint).trim() !== ''
        ? String(mealNameHint).trim()
        : (meal && meal.name) || this.data.selectedMealName || ''

    const parsed = meal ? parseScheduledAtFromApi(meal.scheduledAt, meal.scheduledTimeSpecified) : null
    if (parsed) {
      const idx = values.indexOf(parsed.ymd)
      if (idx >= 0) mealDateIndex = idx
    }

    if (parsed && parsed.timeSpecified) {
      mealTimePickerValue = [parsed.hourIndex, parsed.minuteIndex]
      mealTimeSpecified = true
    } else {
      const suggested = getSuggestedTimePickerIndicesForMealName(nameForHint)
      mealTimePickerValue = suggested
        ? [suggested.hourIndex, suggested.minuteIndex]
        : [nowR.hourIndex, nowR.minuteIndex]
      mealTimeSpecified = false
    }

    const safeTimeValue = clampMealTimePickerValue(mealTimePickerValue, timeRange)
    const mealTimeDisplay = mealTimeSpecified
      ? formatMealTimeDisplay(safeTimeValue[0], safeTimeValue[1])
      : '未选择（非必填）'
    const safeDateIndex =
      mealDateIndex >= 0 && mealDateIndex < labels.length ? mealDateIndex : 0

    this.setData(
      {
        mealDateLabels: labels,
        mealDateValues: values,
        mealDateIndex: safeDateIndex,
        mealDateDisplay: labels[safeDateIndex] || '请选择日期',
        mealTimeRange: timeRange,
        mealTimePickerValue: safeTimeValue,
        mealTimeSpecified,
        mealTimeDisplay
      },
      () => this.refreshPickerBindDataForIOS()
    )
  },

  onMealDateChange(e) {
    const idx = Number(e.detail.value)
    const labels = this.data.mealDateLabels
    if (Number.isNaN(idx) || idx < 0 || idx >= labels.length) return
    this.setData({
      mealDateIndex: idx,
      mealDateDisplay: labels[idx]
    })
  },

  onMealTimeChange(e) {
    const raw = e.detail.value
    const hi = Number(raw[0])
    const mi = Number(raw[1])
    if (Number.isNaN(hi) || Number.isNaN(mi)) return
    this.setData({
      mealTimePickerValue: [hi, mi],
      mealTimeSpecified: true,
      mealTimeDisplay: formatMealTimeDisplay(hi, mi)
    })
  },

  clearMealTime() {
    const suggested = getSuggestedTimePickerIndicesForMealName(this.data.selectedMealName)
    const nowR = getBeijingNowRoundedTo5Min()
    this.setData({
      mealTimeSpecified: false,
      mealTimeDisplay: '未选择（非必填）',
      mealTimePickerValue: suggested
        ? [suggested.hourIndex, suggested.minuteIndex]
        : [nowR.hourIndex, nowR.minuteIndex]
    })
  },

  buildSchedulePayload() {
    const {
      mealDateValues,
      mealDateIndex,
      mealTimeSpecified,
      mealTimePickerValue
    } = this.data
    const scheduledDate = mealDateValues[mealDateIndex]
    return {
      scheduledDate: scheduledDate || '',
      scheduledTimeSpecified: !!mealTimeSpecified,
      scheduledHour: mealTimePickerValue[0],
      scheduledMinute: (mealTimePickerValue[1] || 0) * 5
    }
  },

  toggleSelectAll() {
    const selectAll = !this.data.selectAll
    const dishes = [...this.data.dishes].map(dish => ({
      ...dish,
      selected: selectAll
    }))

    // 更新selectedDishes数组
    const selectedDishes = selectAll ? dishes.map(dish => dish.id) : []

    this.setData({
      dishes,
      selectedDishes,
      selectAll
    }, () => {
      console.log('切换全选状态后，selectedDishes:', this.data.selectedDishes)
      console.log('切换全选状态后，selectAll:', this.data.selectAll)
      console.log('切换全选状态后，dishes:', this.data.dishes)
    })
  },

  toggleDishSelection(e) {
    const id = e.currentTarget.dataset.id

    console.log('toggleDishSelection被调用，id:', id)

    const dishes = [...this.data.dishes]
    const dishIndex = dishes.findIndex(dish => dish.id === id)

    if (dishIndex !== -1) {
      // 切换菜品的选中状态
      dishes[dishIndex].selected = !dishes[dishIndex].selected

      console.log('菜品', id, '的选中状态变为:', dishes[dishIndex].selected)

      // 更新selectedDishes数组
      const selectedDishes = dishes.filter(dish => dish.selected).map(dish => dish.id)

      // 更新全选状态
      const selectAll = selectedDishes.length === dishes.length && dishes.length > 0

      console.log('更新前dishes:', this.data.dishes)
      console.log('更新后dishes:', dishes)
      console.log('selectedDishes:', selectedDishes)

      this.setData({
        dishes,
        selectedDishes,
        selectAll
      }, () => {
        console.log('切换菜品选中状态后，selectedDishes:', this.data.selectedDishes)
        console.log('切换菜品选中状态后，selectAll:', this.data.selectAll)
        console.log('切换菜品选中状态后，dishes:', this.data.dishes)
      })
    }
  },

  // 完成编辑
  async completeEdit() {
    const { selectedMealName, dishes, editingMealId } = this.data

    if (!selectedMealName || !selectedMealName.trim()) {
      wx.showToast({ title: '请输入餐名', icon: 'none' })
      return
    }

    const selectedDishDetails = dishes.filter(dish => dish.selected)
    if (selectedDishDetails.length === 0) {
      wx.showToast({ title: '请选择菜品', icon: 'none' })
      return
    }

    try {
      // 调用云函数更新点餐
      const selectedDishIds = selectedDishDetails.map(d => d.id)
      await API.meal.update(
        editingMealId,
        selectedMealName.trim(),
        selectedDishIds,
        this.buildSchedulePayload()
      )

      // 清除编辑状态
      getApp().globalData.editingMeal = null

      wx.showToast({ title: '修改成功', icon: 'success' })

      // 返回上一页
      setTimeout(() => {
        wx.navigateBack()
      }, 1500)
    } catch (err) {
      console.error('更新点餐失败:', err)
    }
  },

  previewDishImage(e) {
    previewSingleDishImage(e.currentTarget.dataset.url)
  },

  async initiateMeal() {
    console.log('initiateMeal函数被调用')
    const { selectedMealName } = this.data

    // 重新获取最新的 dishes 数据
    const dishes = this.data.dishes

    console.log('当前数据:', { selectedMealName, dishesLength: dishes.length })

    if (!selectedMealName || !selectedMealName.trim()) {
      wx.showToast({ title: '请输入餐名', icon: 'none' })
      return
    }

    // 使用dishes数组中每个菜品的selected属性来过滤选中的菜品
    const selectedDishDetails = dishes.filter(dish => dish.selected)
    console.log('所有菜品:', dishes)
    console.log('选中的菜品:', selectedDishDetails)
    console.log('选中的菜品数量:', selectedDishDetails.length)

    if (selectedDishDetails.length === 0) {
      console.log('未选择菜品')
      wx.showToast({ title: '请选择菜品', icon: 'none' })
      return
    }

    // 显示加载提示
    wx.showLoading({ title: '正在创建点餐流程...' })

    try {
      // 与点餐列表一致：必须写入当前厨房，否则列表按 kitchenId 查询时看不到本条
      const currentKitchen = getApp().globalData.currentKitchen
      const kitchenId =
        currentKitchen && currentKitchen.id != null ? Number(currentKitchen.id) : null
      const selectedDishIds = selectedDishDetails.map(d => d.id)
      const result = await API.meal.create(
        selectedMealName.trim(),
        selectedDishIds,
        kitchenId,
        this.buildSchedulePayload()
      )
      const mealData = result.data

      console.log('创建点餐成功:', mealData)

      // 存储当前点餐到全局数据
      getApp().globalData.currentMeal = mealData

      wx.hideLoading()
      // 发起者订阅：他人下单时可收到订阅消息（需配置模板 ID）
      await requestMealOrderNotifySubscribe()

      // 跳转到点餐页面
      console.log('准备跳转到点餐页面')
      wx.navigateTo({
        url: '/pages/order-food/order-food',
        fail: function(res) {
          console.log('跳转失败:', res)
          wx.showToast({ title: '跳转失败，请重试', icon: 'none' })
        }
      })
    } catch (err) {
      console.error('创建点餐失败:', err)
      wx.hideLoading()
    }
  }
})
