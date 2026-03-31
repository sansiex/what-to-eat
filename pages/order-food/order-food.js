// pages/order-food/order-food.js
const { API } = require('../../utils/cloud-api.js')
const { formatScheduledMealDisplayForOrderFood } = require('../../utils/beijing-meal-schedule.js')
const { formatMealCreatedAtBeijing } = require('../../utils/format-meal-created-at-beijing.js')
const { isDishPlaceholderUrl } = require('../../utils/dish-preview.js')
const { CATEGORIES: TAG_CATEGORIES } = require('../../utils/dish-tag-registry.js')
const { formatTagView } = require('../../utils/dish-tag-view.js')
const { showExitOrEnterKitchenModal, MEAL_LIMIT_MSG } = require('../../utils/enter-my-kitchen.js')

/** 草稿标签 [{ categoryKey, tagCode }] → 与后端 myTags 同结构的展示字段 */
function enrichMyTagsFromRegistry(list) {
  return (list || []).map(t => {
    const cat = TAG_CATEGORIES.find(c => c.key === t.categoryKey)
    const tagDef = cat && cat.tags.find(x => x.code === t.tagCode)
    return {
      categoryKey: t.categoryKey,
      tagCode: t.tagCode,
      tagLabel: tagDef ? tagDef.label : t.tagCode,
      colorKey: cat ? cat.colorKey : 'blue'
    }
  })
}

Page({
  data: {
    /** 正在拉取点餐详情（发起点餐跳转后首屏等） */
    mealLoading: false,
    currentMeal: null,
    searchKeyword: '',
    filteredDishes: [],
    userSelectedDishes: [],
    dishSelectionMap: {}, // 用于存储每个菜品的选中状态
    orders: [],
    orderStats: [], // 订单统计
    updateTimestamp: Date.now(),
    viewMode: false, // 是否为查看模式（只读）
    isInitiator: false, // 是否是点餐发起人
    expandedDishId: null,
    tagRegistryCategories: TAG_CATEGORIES,
    tagPickerVisible: false,
    tagPickerActiveCategory: 'spiciness',
    tagPickerOptions: [],
    tagPickerSelectedCodes: [],
    /** 弹窗内各分类已选 tagCode，与 myTags 同步 */
    tagPickerByCategory: {},
    tagPickerInitialByCategory: {},
    /** 仅前端暂存：每道菜我的标签，点「下单」时与勾选一并提交 */
    dishTagDraft: {},
    /** 参与人数已满 15，不可再发起分享 */
    shareBlocked: false
  },

  onLoad() {
    // 检查是否为查看模式
    const viewMode = getApp().globalData.viewMode || false
    const globalMeal = getApp().globalData.currentMeal
    const mealLoading = !!(globalMeal && globalMeal.id)
    this.setData({ viewMode, tagRegistryCategories: TAG_CATEGORIES, mealLoading })

    this.loadCurrentMeal()
    this.loadOrders()
  },

  noop() {},

  mapDishesWithTags(dishes, draftMap) {
    const draft = draftMap || this.data.dishTagDraft || {}
    return (dishes || []).map(dish => {
      const serverTd = dish.tagDisplay || { groups: [], myTags: [] }
      const draftList = draft[dish.id] || []
      const tagDisplay = {
        groups: serverTd.groups || [],
        myTags: enrichMyTagsFromRegistry(draftList)
      }
      return {
        ...dish,
        imageUrl: dish.imageUrl || dish.image_url || '',
        displayImage: (dish.imageUrl || dish.image_url) || '/images/dish-placeholder.png',
        displayDescription: dish.description || '暂无描述',
        tagView: formatTagView(tagDisplay)
      }
    })
  },

  toggleDishExpand(e) {
    const id = e.currentTarget.dataset.id
    if (id == null) return
    this.setData({
      expandedDishId: this.data.expandedDishId === id ? null : id
    })
  },

  /** 由当前菜 myTags 生成各分类已选列表 */
  buildTagPickerStateFromMyTags(myTags) {
    const by = {}
    TAG_CATEGORIES.forEach(c => {
      by[c.key] = []
    })
    for (const t of myTags || []) {
      const k = t.categoryKey
      if (!by[k]) by[k] = []
      if (k === 'spiciness') {
        by[k] = [t.tagCode]
      } else if (!by[k].includes(t.tagCode)) {
        by[k].push(t.tagCode)
      }
    }
    return by
  },

  /** 右侧具体标签列表（带 selected，避免 WXML 里用 indexOf 在部分基础库不生效） */
  buildTagPickerOptions(byCategory, activeKey) {
    const cat = TAG_CATEGORIES.find(c => c.key === activeKey)
    if (!cat) return []
    const codes = byCategory[activeKey] || []
    const set = new Set(codes)
    return cat.tags.map(t => ({
      code: t.code,
      label: t.label,
      selected: set.has(t.code)
    }))
  },

  openTagPicker() {
    if (this.data.viewMode || !this.data.expandedDishId) {
      wx.showToast({ title: '请先展开菜品', icon: 'none' })
      return
    }
    const dishId = this.data.expandedDishId
    const draftList = (this.data.dishTagDraft && this.data.dishTagDraft[dishId]) || []
    const by = this.buildTagPickerStateFromMyTags(enrichMyTagsFromRegistry(draftList))
    const firstCat = TAG_CATEGORIES[0]
    const firstKey = firstCat.key
    const firstCodes = [...(by[firstKey] || [])]
    const options = this.buildTagPickerOptions(by, firstKey)
    this.setData({
      tagPickerVisible: true,
      tagPickerActiveCategory: firstKey,
      tagPickerByCategory: by,
      tagPickerInitialByCategory: JSON.parse(JSON.stringify(by)),
      tagPickerOptions: options,
      tagPickerSelectedCodes: firstKey === 'spiciness' ? (firstCodes[0] ? [firstCodes[0]] : []) : firstCodes
    })
  },

  closeTagPicker() {
    this.setData({
      tagPickerVisible: false,
      tagPickerActiveCategory: 'spiciness',
      tagPickerSelectedCodes: [],
      tagPickerOptions: [],
      tagPickerByCategory: {},
      tagPickerInitialByCategory: {}
    })
  },

  selectTagPickerCategory(e) {
    const key = e.currentTarget.dataset.catKey || e.currentTarget.dataset.key
    const cat = TAG_CATEGORIES.find(c => c.key === key)
    if (!cat) return
    const codes = [...(this.data.tagPickerByCategory[key] || [])]
    const by = this.data.tagPickerByCategory
    this.setData({
      tagPickerActiveCategory: key,
      tagPickerOptions: this.buildTagPickerOptions(by, key),
      tagPickerSelectedCodes: key === 'spiciness' ? (codes[0] ? [codes[0]] : []) : codes
    })
  },

  togglePickerTag(e) {
    const code = e.currentTarget.dataset.tagCode
    const catKey = this.data.tagPickerActiveCategory
    if (!code || !catKey) return
    let codes = [...(this.data.tagPickerByCategory[catKey] || [])]
    if (catKey === 'spiciness') {
      const idx = codes.indexOf(code)
      codes = idx >= 0 ? [] : [code]
    } else {
      const i = codes.indexOf(code)
      if (i >= 0) codes.splice(i, 1)
      else codes.push(code)
    }
    const nextBy = { ...this.data.tagPickerByCategory, [catKey]: codes }
    this.setData({
      tagPickerByCategory: nextBy,
      tagPickerSelectedCodes: [...codes],
      tagPickerOptions: this.buildTagPickerOptions(nextBy, catKey)
    })
  },

  clearTagPickerSelection() {
    const cleared = {}
    TAG_CATEGORIES.forEach(c => {
      cleared[c.key] = []
    })
    const active = this.data.tagPickerActiveCategory
    this.setData({
      tagPickerByCategory: cleared,
      tagPickerSelectedCodes: [],
      tagPickerOptions: this.buildTagPickerOptions(cleared, active)
    })
  },

  confirmTagPicker() {
    const dishId = this.data.expandedDishId
    const final = this.data.tagPickerByCategory || {}
    if (!dishId) {
      this.closeTagPicker()
      return
    }
    const flatList = []
    TAG_CATEGORIES.forEach(cat => {
      (final[cat.key] || []).forEach(code => {
        flatList.push({ categoryKey: cat.key, tagCode: code })
      })
    })
    const dishTagDraft = { ...this.data.dishTagDraft, [dishId]: flatList }
    const kw = this.data.searchKeyword || ''
    const dishes = this.data.currentMeal.dishes || []
    const filtered = kw
      ? dishes.filter(dish => dish.name.toLowerCase().includes(kw.toLowerCase()))
      : dishes
    const filteredDishes = this.mapDishesWithTags(filtered, dishTagDraft)
    this.setData({ dishTagDraft, filteredDishes })
    wx.showToast({ title: '已更新，下单时提交', icon: 'none' })
    this.closeTagPicker()
  },

  removeMyDishTag(e) {
    if (this.data.viewMode) return
    const dishId = parseInt(e.currentTarget.dataset.dishId, 10)
    const categoryKey = e.currentTarget.dataset.category
    const tagCode = e.currentTarget.dataset.code
    if (!dishId || !categoryKey || !tagCode) return
    const list = [...((this.data.dishTagDraft && this.data.dishTagDraft[dishId]) || [])]
    const next = list.filter(t => !(t.categoryKey === categoryKey && t.tagCode === tagCode))
    const dishTagDraft = { ...this.data.dishTagDraft, [dishId]: next }
    const kw = this.data.searchKeyword || ''
    const dishes = this.data.currentMeal.dishes || []
    const filtered = kw
      ? dishes.filter(dish => dish.name.toLowerCase().includes(kw.toLowerCase()))
      : dishes
    const filteredDishes = this.mapDishesWithTags(filtered, dishTagDraft)
    this.setData({ dishTagDraft, filteredDishes })
  },

  // 获取微信用户信息
  getUserInfo(callback) {
    // 开发环境可以设置测试用户名（正式发布时请删除或注释掉这行）
    const testUserName = '' // 例如：'张三'

    if (testUserName) {
      wx.setStorageSync('currentUser', testUserName)
      wx.setStorageSync('currentUserName', testUserName)
      console.log('使用测试用户名:', testUserName)
      if (callback) callback()
      return
    }

    wx.getUserProfile({
      desc: '用于展示用户昵称',
      success: (res) => {
        const userInfo = res.userInfo
        wx.setStorageSync('currentUser', userInfo.nickName)
        wx.setStorageSync('currentUserName', userInfo.nickName)
        console.log('获取用户信息成功:', userInfo.nickName)
        if (callback) callback()
      },
      fail: (err) => {
        console.log('获取用户信息失败:', err)
        // 如果获取失败，使用默认的随机用户
        let currentUser = wx.getStorageSync('currentUser')
        if (!currentUser) {
          currentUser = '用户' + Math.floor(Math.random() * 1000)
          wx.setStorageSync('currentUser', currentUser)
          wx.setStorageSync('currentUserName', currentUser)
        }
        if (callback) callback()
      }
    })
  },

  onShow() {
    // 检查是否为查看模式
    const viewMode = getApp().globalData.viewMode || false
    this.setData({ viewMode })

    // 检查是否需要重新加载餐食（globalData中的餐食与当前不同）
    const globalMeal = getApp().globalData.currentMeal
    const currentMeal = this.data.currentMeal

    if (globalMeal && (!currentMeal || currentMeal.id !== globalMeal.id)) {
      // 餐食发生变化，重新加载
      this.loadCurrentMeal()
    } else if (currentMeal) {
      // 餐食未变，只刷新订单统计和点选信息，不覆盖用户选择
      this.loadOrderStats(currentMeal.id)
      // 刷新点选信息映射
      this.refreshDishOrderersMap()
    }
  },

  onHide() {
    // 离开页面时清除查看模式标记
    getApp().globalData.viewMode = false
  },

  // 加载当前餐食数据
  async loadCurrentMeal() {
    const globalMeal = getApp().globalData.currentMeal
    console.log('globalData中的餐食:', globalMeal)

    if (!globalMeal) {
      this.setData({ currentMeal: null, mealLoading: false })
      return
    }

    this.setData({ mealLoading: true })

    try {
      // 从云函数获取完整的餐食详情（包含菜品列表）
      const result = await API.meal.get(globalMeal.id)
      const currentMeal = result.data

      console.log('从云函数获取的餐食详情:', currentMeal)
      console.log('餐食中的菜品:', currentMeal.dishes)
      console.log('菜品数量:', currentMeal.dishes ? currentMeal.dishes.length : 0)

      if (!currentMeal.dishes || currentMeal.dishes.length === 0) {
        wx.showToast({ title: '该点餐没有关联菜品', icon: 'none' })
        this.setData({ currentMeal: null, mealLoading: false })
        return
      }

      // 检查是否餐食发生变化
      const mealChanged = !this.data.currentMeal || this.data.currentMeal.id !== currentMeal.id
      let userSelectedDishes

      if (mealChanged) {
        // 餐食变化时：若用户已下单过，按历史订单勾选；否则默认全不勾选
        try {
          const orderResult = await API.order.getMyOrder(currentMeal.id)
          const myOrder = orderResult.data
          if (myOrder.hasOrdered && myOrder.orders && myOrder.orders.length > 0) {
            const validDishIds = new Set(currentMeal.dishes.map(d => d.id))
            userSelectedDishes = myOrder.orders
              .map(o => o.dishId)
              .filter(id => validDishIds.has(id))
          } else {
            userSelectedDishes = []
          }
        } catch (err) {
          console.error('获取用户订单失败，默认全不勾选:', err)
          userSelectedDishes = []
        }
      } else {
        // 餐食未变，保持原有选择状态
        userSelectedDishes = this.data.userSelectedDishes
      }

      // 构建菜品选择状态映射
      const dishSelectionMap = {}
      currentMeal.dishes.forEach(dish => {
        dishSelectionMap[dish.id] = userSelectedDishes.includes(dish.id)
      })

      // 构建菜品点选信息映射（使用云函数返回的 orderers 数据）
      const dishOrderersMap = {}
      currentMeal.dishes.forEach(dish => {
        const orderers = dish.orderers || []
        dishOrderersMap[dish.id] = orderers.length > 0 ? '已点：' + orderers.join('、') : '暂无点选'
      })

      let dishTagDraft = {}
      if (mealChanged) {
        currentMeal.dishes.forEach(d => {
          const mt = (d.tagDisplay && d.tagDisplay.myTags) || []
          dishTagDraft[d.id] = mt.map(t => ({ categoryKey: t.categoryKey, tagCode: t.tagCode }))
        })
      } else {
        dishTagDraft = { ...(this.data.dishTagDraft || {}) }
      }

      const dishesWithDisplay = this.mapDishesWithTags(currentMeal.dishes, dishTagDraft)

      // 格式化创建时间
      const formattedCreatedAt = formatMealCreatedAtBeijing(currentMeal.createdAt, true)

      const formattedScheduledMeal = formatScheduledMealDisplayForOrderFood(
        currentMeal.scheduledAt,
        currentMeal.scheduledTimeSpecified
      )

      // 创建带有格式化时间的 currentMeal 副本
      const currentMealWithFormattedTime = {
        ...currentMeal,
        formattedCreatedAt,
        formattedScheduledMeal
      }

      // 判断当前用户是否是发起人（使用后端返回的 isCreator）
      const isInitiator = !!currentMeal.isCreator

      const participantLimit =
        currentMeal.participantLimit != null ? currentMeal.participantLimit : 15
      const participantCount =
        currentMeal.participantCount != null ? currentMeal.participantCount : 0
      const shareBlocked = participantCount >= participantLimit

      if (!this.data.viewMode) {
        try {
          const rp = await API.meal.recordParticipant(currentMeal.id)
          if (rp.data && rp.data.participantLimitReached) {
            showExitOrEnterKitchenModal(MEAL_LIMIT_MSG)
          }
        } catch (e) {
          console.warn('recordParticipant', e)
        }
      }

      this.setData({
        currentMeal: currentMealWithFormattedTime,
        filteredDishes: dishesWithDisplay,
        userSelectedDishes,
        dishSelectionMap,
        dishOrderersMap,
        isInitiator,
        dishTagDraft,
        mealLoading: false,
        shareBlocked
      })

      // 为发起人预生成分享令牌（参与人数未满时）
      if (isInitiator && !shareBlocked) {
        this.preGenerateShareToken(currentMeal.id)
      }

      // 加载订单统计
      this.loadOrderStats(currentMeal.id)
    } catch (err) {
      console.error('加载餐食详情失败:', err)
      wx.showToast({ title: '加载餐食失败', icon: 'none' })
      this.setData({ currentMeal: null, mealLoading: false })
    }
  },

  // 加载订单统计
  async loadOrderStats(mealId) {
    if (!mealId) return
    try {
      const result = await API.order.listByMeal(mealId)
      // 后端返回的是 dishOrders，需要转换为前端需要的格式
      const dishOrders = result.data.dishOrders || []
      const orderStats = dishOrders.map(order => ({
        dishId: order.dishId,
        ordererNames: order.orderers || [],
        orderCount: order.orderCount
      }))
      this.setData({ orderStats })
    } catch (err) {
      console.error('加载订单统计失败:', err)
    }
  },

  // 加载订单数据（仅加载，不覆盖用户选择）
  async loadOrders() {
    const currentMeal = this.data.currentMeal
    if (!currentMeal) return

    try {
      // 刷新订单统计
      await this.loadOrderStats(currentMeal.id)
    } catch (err) {
      console.error('加载订单失败:', err)
    }
  },

  // 同步订单到选择状态（用于页面加载时恢复用户的订单选择）
  async syncOrderToSelection() {
    const currentMeal = this.data.currentMeal
    if (!currentMeal) return

    try {
      // 获取我在当前点餐中的订单
      const result = await API.order.getMyOrder(currentMeal.id)
      const myOrder = result.data

      // 如果用户已下单，同步到选择状态
      if (myOrder.hasOrdered && myOrder.orders) {
        const userSelectedDishes = myOrder.orders.map(o => o.dishId)
        const dishSelectionMap = {}
        this.data.filteredDishes.forEach(dish => {
          dishSelectionMap[dish.id] = userSelectedDishes.includes(dish.id)
        })

        this.setData({
          userSelectedDishes,
          dishSelectionMap
        })
      }
    } catch (err) {
      console.error('同步订单到选择失败:', err)
    }
  },

  // 搜索菜品
  onSearch(e) {
    const keyword = e.detail.value
    this.setData({ searchKeyword: keyword })
    this.filterDishes(keyword)
  },

  // 过滤菜品
  filterDishes(keyword) {
    if (!this.data.currentMeal) return

    const dishes = this.data.currentMeal.dishes
    const filtered = dishes.filter(dish =>
      dish.name.toLowerCase().includes(keyword.toLowerCase())
    )
    const filteredDishes = this.mapDishesWithTags(filtered, this.data.dishTagDraft)
    const idSet = new Set(filteredDishes.map(d => d.id))
    const expandedDishId = idSet.has(this.data.expandedDishId) ? this.data.expandedDishId : null
    this.setData({ filteredDishes, expandedDishId })
  },

  // 处理checkbox-group的change事件
  onCheckboxChange(e) {
    console.log('onCheckboxChange被调用')
    console.log('事件对象:', e)

    // checkbox-group 返回的是字符串数组，需要转换为数字
    const selectedValues = (e.detail.value || []).map(v => parseInt(v))
    console.log('选中的值(转换后):', selectedValues)

    // 构建新的状态映射
    const newSelectionMap = {}
    this.data.filteredDishes.forEach(dish => {
      newSelectionMap[dish.id] = selectedValues.includes(dish.id)
    })

    console.log('更新后的状态映射:', newSelectionMap)
    console.log('更新后的选中列表:', selectedValues)

    // 强制更新数据
    this.setData({
      dishSelectionMap: newSelectionMap,
      userSelectedDishes: selectedValues
    })
  },

  // 检查菜品是否被选中
  isSelected(id) {
    const result = this.data.dishSelectionMap[id] || false
    console.log('isSelected检查:', id, '结果:', result, '当前选中列表:', this.data.userSelectedDishes)
    return result
  },

  // 获取点选该菜品的用户
  getDishOrderers(dishId) {
    const orderStats = this.data.orderStats
    const stat = orderStats.find(s => s.dishId === dishId)
    return stat ? stat.ordererNames : []
  },

  // 构建菜品点选信息映射
  buildDishOrderersMap() {
    const dishOrderersMap = {}
    const orderStats = this.data.orderStats

    this.data.filteredDishes.forEach(dish => {
      const stat = orderStats.find(s => s.dishId === dish.id)
      const orderers = stat ? stat.ordererNames : []
      dishOrderersMap[dish.id] = orderers.length > 0 ? '已点：' + orderers.join('、') : '暂无点选'
    })

    return dishOrderersMap
  },

  // 刷新菜品点选信息映射（不覆盖用户选择）
  refreshDishOrderersMap() {
    const dishOrderersMap = this.buildDishOrderersMap()
    this.setData({ dishOrderersMap })
  },

  // 获取菜品点选人数
  getDishOrderCount(dishId) {
    const orderStats = this.data.orderStats
    const stat = orderStats.find(s => s.dishId === dishId)
    return stat ? stat.orderCount : 0
  },

  // 下单
  async placeOrder() {
    if (!this.data.currentMeal) {
      wx.showToast({ title: '暂无发起的餐食', icon: 'none' })
      return
    }

    if (this.data.userSelectedDishes.length === 0) {
      wx.showToast({ title: '请至少选择一个菜品', icon: 'none' })
      return
    }

    try {
      const draft = this.data.dishTagDraft || {}
      const dishTagsByDishId = {}
      this.data.userSelectedDishes.forEach(id => {
        dishTagsByDishId[id] = draft[id] || []
      })
      await API.order.create(this.data.currentMeal.id, this.data.userSelectedDishes, dishTagsByDishId)

      // 准备跳转到下单完成页面所需的数据
      getApp().globalData.orderCompleteData = {
        meal: this.data.currentMeal,
        allDishes: this.data.filteredDishes,
        orderedDishIds: [...this.data.userSelectedDishes],
        isCreator: this.data.isInitiator,
        shareToken: this.data.shareToken || ''
      }

      wx.navigateTo({ url: '/pages/order-complete/order-complete' })
    } catch (err) {
      console.error('下单失败:', err)
    }
  },

  async preGenerateShareToken(mealId) {
    try {
      const result = await API.share.generateShareLink(mealId)
      const token = result && result.data && result.data.shareToken
      if (token) {
        this.setData({ shareToken: token })
      }
    } catch (e) {
      console.warn('预生成分享令牌失败:', e)
    }
  },

  onShareBlockedTap() {
    wx.showModal({
      content: '参与点餐人数达到上限，无法继续分享',
      showCancel: false
    })
  },

  previewDishImage(e) {
    const url = e.currentTarget.dataset.url
    if (isDishPlaceholderUrl(url)) return
    const urls = (this.data.filteredDishes || [])
      .map(function(d) { return d.displayImage || '' })
      .filter(function(u) { return !isDishPlaceholderUrl(u) })
    wx.previewImage({
      current: url,
      urls: urls.length > 0 ? urls : [url]
    })
  },

  onShareAppMessage(e) {
    const mealId = (e && e.target && e.target.dataset && e.target.dataset.id) || (this.data.currentMeal && this.data.currentMeal.id)
    const mealName = (e && e.target && e.target.dataset && e.target.dataset.name) || (this.data.currentMeal && this.data.currentMeal.name)

    if (!mealId) {
      return {
        title: '今天吃什么？一起来点餐吧！',
        path: '/pages/meal-list/meal-list'
      }
    }

    const token = this.data.shareToken || ''
    const sharePath = token
      ? `/pages/share-meal/share-meal?token=${token}&mealId=${mealId}`
      : `/pages/share-meal/share-meal?mealId=${mealId}`

    return {
      title: `【${mealName || '点餐'}】快来一起点餐吧！`,
      path: sharePath,
      imageUrl: '/images/share_card.jpg'
    }
  }
})
