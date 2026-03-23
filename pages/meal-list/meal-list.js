// pages/meal-list/meal-list.js
const { API } = require('../../utils/cloud-api.js')
const {
  partitionMealsByScheduledBeijingDate,
  mealEffectiveScheduledBeijingYmd
} = require('../../utils/beijing-day.js')
const { formatScheduledMealDisplayForOrderFood } = require('../../utils/beijing-meal-schedule.js')
const { formatMealCreatedAtBeijing } = require('../../utils/format-meal-created-at-beijing.js')

/** 首屏一次拉取条数（不按日期拆 API，前端按北京时间分区，避免库时区与 ISO 边界不一致） */
const MEAL_LIST_PAGE_SIZE = 500
/** 「加载更多」追加页大小 */
const MEAL_LIST_MORE_SIZE = 100

Page({
  data: {
    /** 用餐日期为明天及以后（北京时间） */
    mealsFuture: [],
    /** 用餐日期为今天 */
    mealsToday: [],
    /** 用餐日期早于今天 */
    mealsHistory: [],
    sectionExpanded: {
      future: true,
      today: true,
      history: false
    },
    historyPage: 1,
    historyTotal: 0,
    historyLoading: false,
    historyNoMore: false,
    hasAnyMeal: false,
    shareTokenMap: {},
    /** 已拉取的原始列表（用于追加分页后重新分区） */
    _mealListRawBuffer: []
  },

  onLoad() {
    this.loadMeals(true)
  },

  onShow() {
    this.loadMeals(true)
  },

  onReachBottom() {
    if (!this.data.sectionExpanded.history) return
    if (this.data.historyLoading || this.data.historyNoMore) return
    const buf = this.data._mealListRawBuffer || []
    const total = this.data.historyTotal || 0
    if (buf.length >= total && total > 0) {
      this.setData({ historyNoMore: true })
      return
    }
    this.loadMoreHistory()
  },

  mapMealRow(meal, canManageMeals) {
    const weekdays = ['周日', '周一', '周二', '周三', '周四', '周五', '周六']
    const beijingDate = new Date(new Date(meal.createdAt).getTime() + 8 * 60 * 60 * 1000)
    const weekday = weekdays[beijingDate.getUTCDay()]
    const formattedCreatedAt = formatMealCreatedAtBeijing(meal.createdAt)
    const createdAtDisplay = formattedCreatedAt ? `${weekday} ${formattedCreatedAt}` : ''
    const scheduledMealDisplay = formatScheduledMealDisplayForOrderFood(
      meal.scheduledAt,
      meal.scheduledTimeSpecified
    )
    return {
      ...meal,
      createdAtDisplay,
      scheduledMealDisplay,
      status: meal.status === 1 ? 'ordering' : 'closed',
      canManageMeals
    }
  },

  findMealById(mealId) {
    const { mealsFuture, mealsToday, mealsHistory } = this.data
    const all = [...mealsFuture, ...mealsToday, ...mealsHistory]
    return all.find(m => m.id === mealId)
  },

  _mapAndSortBuckets(rawFuture, rawToday, rawHistory, canManageMeals) {
    const createdDesc = (a, b) => {
      const ta = new Date(a.createdAt || a.created_at || 0).getTime()
      const tb = new Date(b.createdAt || b.created_at || 0).getTime()
      return tb - ta
    }
    const futureSort = (a, b) => {
      const ya = mealEffectiveScheduledBeijingYmd(a)
      const yb = mealEffectiveScheduledBeijingYmd(b)
      if (ya !== yb) return (ya || '').localeCompare(yb || '')
      return createdDesc(a, b)
    }
    const historySort = (a, b) => {
      const ya = mealEffectiveScheduledBeijingYmd(a)
      const yb = mealEffectiveScheduledBeijingYmd(b)
      if (ya !== yb) return (yb || '').localeCompare(ya || '')
      return createdDesc(a, b)
    }
    return {
      mealsFuture: rawFuture.map(m => this.mapMealRow(m, canManageMeals)).sort(futureSort),
      mealsToday: rawToday.map(m => this.mapMealRow(m, canManageMeals)).sort(createdDesc),
      mealsHistory: rawHistory.map(m => this.mapMealRow(m, canManageMeals)).sort(historySort)
    }
  },

  async loadMeals(resetHistory) {
    try {
      if (typeof getApp().initDefaultKitchen === 'function') {
        await getApp().initDefaultKitchen()
      }

      const currentKitchen = getApp().globalData.currentKitchen
      const kitchenId = currentKitchen ? currentKitchen.id : null
      if (!kitchenId) {
        this.setData({
          mealsFuture: [],
          mealsToday: [],
          mealsHistory: [],
          hasAnyMeal: false,
          historyTotal: 0,
          historyNoMore: true,
          _mealListRawBuffer: []
        })
        return
      }

      const role = currentKitchen && currentKitchen.role
      const canManageMeals = role === 'owner' || role === 'admin'
      const listRes = await API.meal.list(null, kitchenId, {
        page: 1,
        pageSize: MEAL_LIST_PAGE_SIZE
      })

      const rawList = listRes.data.list || []
      const total =
        listRes.data.total != null ? Number(listRes.data.total) : rawList.length

      const { future: rawF, today: rawT, history: rawH } =
        partitionMealsByScheduledBeijingDate(rawList)

      const { mealsFuture, mealsToday, mealsHistory } = this._mapAndSortBuckets(
        rawF,
        rawT,
        rawH,
        canManageMeals
      )

      const noFuture = mealsFuture.length === 0
      const noToday = mealsToday.length === 0
      const expandHistoryDefault =
        noFuture && noToday && (total > 0 || mealsHistory.length > 0)

      const hasAnyMeal =
        mealsFuture.length > 0 ||
        mealsToday.length > 0 ||
        mealsHistory.length > 0 ||
        total > 0

      const fetchedAll = rawList.length >= total

      this.setData({
        _mealListRawBuffer: rawList,
        mealsFuture,
        mealsToday,
        mealsHistory,
        historyPage: 1,
        historyTotal: total,
        historyLoading: false,
        historyNoMore: fetchedAll || total === 0,
        hasAnyMeal,
        sectionExpanded: {
          future: !expandHistoryDefault,
          today: !expandHistoryDefault,
          history: expandHistoryDefault
        }
      })

      this.preGenerateShareTokens([...mealsFuture, ...mealsToday, ...mealsHistory])
    } catch (err) {
      console.error('加载点餐列表失败:', err)
    }
  },

  async loadMoreHistory() {
    const currentKitchen = getApp().globalData.currentKitchen
    const kitchenId = currentKitchen ? currentKitchen.id : null
    if (!kitchenId) return

    const { historyPage, historyTotal, historyLoading, _mealListRawBuffer } = this.data
    if (historyLoading) return

    const buf = _mealListRawBuffer || []
    if (buf.length >= historyTotal && historyTotal > 0) {
      this.setData({ historyNoMore: true })
      return
    }

    const role = currentKitchen && currentKitchen.role
    const canManageMeals = role === 'owner' || role === 'admin'
    const nextPage = historyPage + 1

    this.setData({ historyLoading: true })
    try {
      const result = await API.meal.list(null, kitchenId, {
        page: nextPage,
        pageSize: MEAL_LIST_MORE_SIZE
      })
      const chunk = result.data.list || []
      const total =
        result.data.total != null ? Number(result.data.total) : historyTotal
      const merged = buf.concat(chunk)
      const { future: rawF, today: rawT, history: rawH } =
        partitionMealsByScheduledBeijingDate(merged)

      const { mealsFuture, mealsToday, mealsHistory } = this._mapAndSortBuckets(
        rawF,
        rawT,
        rawH,
        canManageMeals
      )

      const fetchedAll = merged.length >= total || chunk.length === 0

      this.setData({
        _mealListRawBuffer: merged,
        mealsFuture,
        mealsToday,
        mealsHistory,
        historyPage: nextPage,
        historyTotal: total,
        historyNoMore: fetchedAll,
        historyLoading: false
      })
      if (chunk.length > 0) {
        this.preGenerateShareTokens([...mealsFuture, ...mealsToday, ...mealsHistory])
      }
    } catch (e) {
      console.error('加载历史点餐失败:', e)
      this.setData({ historyLoading: false })
    }
  },

  toggleSection(e) {
    const key = e.currentTarget.dataset.key
    if (!key) return
    const sectionExpanded = { ...this.data.sectionExpanded }
    sectionExpanded[key] = !sectionExpanded[key]
    this.setData({ sectionExpanded })
  },

  async preGenerateShareTokens(meals) {
    const myActiveMeals = meals.filter(m => m.canManageMeals && m.status === 'ordering')
    const tokenMap = this.data.shareTokenMap || {}
    for (let i = 0; i < myActiveMeals.length; i++) {
      const meal = myActiveMeals[i]
      if (tokenMap[meal.id]) continue
      try {
        const result = await API.share.generateShareLink(meal.id)
        const token = result && result.data && result.data.shareToken
        if (token) {
          tokenMap[meal.id] = token
        }
      } catch (e) {
        console.warn('预生成分享令牌失败 mealId=' + meal.id, e)
      }
    }
    this.setData({ shareTokenMap: tokenMap })
  },

  async editMeal(e) {
    const mealId = e.currentTarget.dataset.id
    try {
      const result = await API.meal.get(mealId)
      const meal = result.data
      if (!meal) {
        wx.showToast({ title: '点餐不存在', icon: 'none' })
        return
      }
      getApp().globalData.editingMeal = meal
      wx.navigateTo({
        url: '/pages/initiate-meal/initiate-meal?mode=edit'
      })
    } catch (err) {
      console.error('获取餐食详情失败:', err)
      wx.showToast({ title: '加载失败', icon: 'none' })
    }
  },

  closeMeal(e) {
    const mealId = e.currentTarget.dataset.id
    wx.showModal({
      title: '确认收单',
      content: '收单后将不能再点餐，是否继续？',
      success: async (res) => {
        if (res.confirm) {
          try {
            await API.meal.close(mealId)
            this.loadMeals(true)
            wx.showToast({ title: '收单成功', icon: 'success' })
          } catch (err) {
            console.error('收单失败:', err)
          }
        }
      }
    })
  },

  goMealDetail(e) {
    const mealId = e.currentTarget.dataset.id
    wx.navigateTo({
      url: `/pages/meal-detail/meal-detail?mealId=${mealId}`
    })
  },

  async goOrder(e) {
    const mealId = e.currentTarget.dataset.id
    const meal = this.findMealById(mealId)
    if (!meal) {
      wx.showToast({ title: '点餐不存在', icon: 'none' })
      return
    }
    if (meal.status === 'closed') {
      wx.showToast({ title: '该点餐已收单', icon: 'none' })
      return
    }
    getApp().globalData.currentMeal = meal
    wx.navigateTo({
      url: '/pages/order-food/order-food'
    })
  },

  async viewMeal(e) {
    const mealId = e.currentTarget.dataset.id
    try {
      const result = await API.meal.get(mealId)
      const meal = result.data
      if (!meal) {
        wx.showToast({ title: '点餐不存在', icon: 'none' })
        return
      }
      getApp().globalData.currentMeal = meal
      getApp().globalData.viewMode = true
      wx.navigateTo({
        url: '/pages/order-food/order-food'
      })
    } catch (err) {
      console.error('获取餐食详情失败:', err)
      wx.showToast({ title: '加载失败', icon: 'none' })
    }
  },

  async reopenMeal(e) {
    const mealId = e.currentTarget.dataset.id
    wx.showModal({
      title: '确认恢复点餐',
      content: '恢复后可以继续点餐，是否继续？',
      success: async (res) => {
        if (res.confirm) {
          try {
            await API.meal.reopen(mealId)
            wx.showToast({ title: '恢复成功', icon: 'success' })
            this.loadMeals(true)
          } catch (err) {
            console.error('恢复点餐失败:', err)
            wx.showToast({ title: '恢复失败', icon: 'none' })
          }
        }
      }
    })
  },

  async shareMeal(e) {
    const mealId = e.currentTarget.dataset.id
    const meal = this.findMealById(mealId)
    if (!meal) {
      wx.showToast({ title: '点餐不存在', icon: 'none' })
      return
    }
    if (meal.status === 'closed') {
      wx.showToast({ title: '已收单的点餐不能分享', icon: 'none' })
      return
    }
    try {
      const result = await API.share.generateShareLink(mealId)
      const { shareUrl } = result.data
      wx.showActionSheet({
        itemList: ['复制链接', '分享给好友'],
        success: (res) => {
          if (res.tapIndex === 0) {
            wx.setClipboardData({
              data: shareUrl,
              success: () => {
                wx.showToast({ title: '链接已复制', icon: 'success' })
              }
            })
          } else if (res.tapIndex === 1) {
            wx.showToast({ title: '请使用右上角分享按钮', icon: 'none' })
          }
        }
      })
    } catch (err) {
      console.error('生成分享链接失败:', err)
      wx.showToast({ title: '分享失败', icon: 'none' })
    }
  },

  onShareAppMessage(e) {
    const mealId = e.target.dataset.id
    const mealName = e.target.dataset.name
    if (!mealId) {
      return {
        title: '今天吃什么？一起来点餐吧！',
        path: '/pages/meal-list/meal-list'
      }
    }
    const tokenMap = this.data.shareTokenMap || {}
    const token = tokenMap[mealId] || ''
    const sharePath = token
      ? `/pages/share-meal/share-meal?token=${token}&mealId=${mealId}`
      : `/pages/share-meal/share-meal?mealId=${mealId}`
    return {
      title: `【${mealName}】快来一起点餐吧！`,
      path: sharePath,
      imageUrl: '/images/share_card.jpg'
    }
  }
})
