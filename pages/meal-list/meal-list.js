// pages/meal-list/meal-list.js
const { API } = require('../../utils/cloud-api.js')
const {
  partitionMealsByScheduledBeijingDate,
  mealEffectiveScheduledBeijingYmd,
  partitionMealsByBeijingCalendar,
  getMealListBeijingBoundaries
} = require('../../utils/beijing-day.js')
const { formatScheduledMealDisplayForOrderFood } = require('../../utils/beijing-meal-schedule.js')
const { formatMealCreatedAtBeijing } = require('../../utils/format-meal-created-at-beijing.js')

/** 首屏一次拉取条数（不按日期拆 API，前端按北京时间分区，避免库时区与 ISO 边界不一致） */
const MEAL_LIST_PAGE_SIZE = 500
/** 「加载更多」追加页大小 */
const MEAL_LIST_MORE_SIZE = 100

/** 点餐列表排序方式（缓存） */
const MEAL_LIST_SORT_MODE_KEY = 'wte_meal_list_sort_mode'
/** 按用餐时间（原默认分区） */
const SORT_SCHEDULED = 'scheduled'
/** 按发起时间：今天 / 昨天 / 历史 */
const SORT_CREATED = 'created'
const SORT_MODE_PICKER_LABELS = ['按发起时间排列', '按用餐时间排列']

function readStoredSortMode() {
  try {
    const v = wx.getStorageSync(MEAL_LIST_SORT_MODE_KEY)
    if (v === SORT_CREATED || v === SORT_SCHEDULED) return v
  } catch (e) {
    /* ignore */
  }
  return SORT_SCHEDULED
}

function writeStoredSortMode(mode) {
  try {
    wx.setStorageSync(MEAL_LIST_SORT_MODE_KEY, mode)
  } catch (e) {
    /* ignore */
  }
}

function sortModeToPickerIndex(mode) {
  return mode === SORT_CREATED ? 0 : 1
}

Page({
  data: {
    sortMode: SORT_SCHEDULED,
    sortModeIndex: 1,
    sortModePickerRange: SORT_MODE_PICKER_LABELS,
    sortModePickerDisplay: SORT_MODE_PICKER_LABELS[1],
    mealSections: [],
    sectionExpanded: {
      future: true,
      today: true,
      history: false,
      cToday: true,
      cYesterday: true,
      cHistory: false
    },
    historyPage: 1,
    historyTotal: 0,
    historyLoading: false,
    historyNoMore: false,
    /** 首屏/刷新整表加载中 */
    listLoading: true,
    hasAnyMeal: false,
    shareTokenMap: {},
    _mealListRawBuffer: []
  },

  onLoad() {
    const sortMode = readStoredSortMode()
    const sortModeIndex = sortModeToPickerIndex(sortMode)
    this.setData({
      sortMode,
      sortModeIndex,
      sortModePickerDisplay: SORT_MODE_PICKER_LABELS[sortModeIndex]
    })
    this.loadMeals(true)
  },

  onShow() {
    this.loadMeals(true)
  },

  onReachBottom() {
    const histKey = this.data.sortMode === SORT_SCHEDULED ? 'history' : 'cHistory'
    if (!this.data.sectionExpanded[histKey]) return
    if (this.data.historyLoading || this.data.historyNoMore) return
    const buf = this.data._mealListRawBuffer || []
    const total = this.data.historyTotal || 0
    if (buf.length >= total && total > 0) {
      this.setData({ historyNoMore: true })
      return
    }
    this.loadMoreHistory()
  },

  onSortModeChange(e) {
    const idx = Number(e.detail.value)
    if (Number.isNaN(idx) || idx === this.data.sortModeIndex) return
    const mode = idx === 0 ? SORT_CREATED : SORT_SCHEDULED
    writeStoredSortMode(mode)
    this.setData({
      sortMode: mode,
      sortModeIndex: idx,
      sortModePickerDisplay: SORT_MODE_PICKER_LABELS[idx]
    })
    this._repartitionFromBuffer(true)
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
    const sections = this.data.mealSections || []
    for (let i = 0; i < sections.length; i++) {
      const list = sections[i].list || []
      const m = list.find((x) => x.id === mealId)
      if (m) return m
    }
    return null
  },

  _partitionRaw(sortMode, rawList) {
    if (sortMode === SORT_SCHEDULED) {
      const { future, today, history } = partitionMealsByScheduledBeijingDate(rawList)
      return { rawA: future, rawB: today, rawC: history }
    }
    const boundaries = getMealListBeijingBoundaries()
    const { today, yesterday, history } = partitionMealsByBeijingCalendar(rawList, boundaries)
    return { rawA: today, rawB: yesterday, rawC: history }
  },

  _mapAndSortThreeBuckets(sortMode, rawA, rawB, rawC, canManageMeals) {
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
    const mapRow = (m) => this.mapMealRow(m, canManageMeals)
    if (sortMode === SORT_SCHEDULED) {
      return {
        bucket0: rawA.map(mapRow).sort(futureSort),
        bucket1: rawB.map(mapRow).sort(createdDesc),
        bucket2: rawC.map(mapRow).sort(historySort)
      }
    }
    return {
      bucket0: rawA.map(mapRow).sort(createdDesc),
      bucket1: rawB.map(mapRow).sort(createdDesc),
      bucket2: rawC.map(mapRow).sort(createdDesc)
    }
  },

  _computeExpandDefaults(b0, b1, b2, total) {
    const emptyTopTwo = b0.length === 0 && b1.length === 0
    const expandHist = emptyTopTwo && (total > 0 || b2.length > 0)
    return {
      future: !expandHist,
      today: !expandHist,
      history: expandHist,
      cToday: !expandHist,
      cYesterday: !expandHist,
      cHistory: expandHist
    }
  },

  _buildMealSections(sortMode, bucket0, bucket1, bucket2, historyTotal, sectionExpanded) {
    const rows =
      sortMode === SORT_SCHEDULED
        ? [
            {
              key: 'future',
              title: '明天及以后用餐',
              emptyText: '暂无未来用餐的点餐',
              useTotal: false,
              isHistory: false
            },
            {
              key: 'today',
              title: '今天用餐',
              emptyText: '暂无今天用餐的点餐',
              useTotal: false,
              isHistory: false
            },
            {
              key: 'history',
              title: '历史点餐',
              emptyText: '暂无历史点餐',
              useTotal: true,
              isHistory: true
            }
          ]
        : [
            {
              key: 'cToday',
              title: '今天的点餐',
              emptyText: '暂无今天的点餐',
              useTotal: false,
              isHistory: false
            },
            {
              key: 'cYesterday',
              title: '昨天的点餐',
              emptyText: '暂无昨天的点餐',
              useTotal: false,
              isHistory: false
            },
            {
              key: 'cHistory',
              title: '历史点餐',
              emptyText: '暂无历史点餐',
              useTotal: true,
              isHistory: true
            }
          ]
    const lists = [bucket0, bucket1, bucket2]
    return rows.map((row, i) => ({
      key: row.key,
      title: row.title,
      emptyText: row.emptyText,
      isHistory: row.isHistory,
      list: lists[i],
      count: row.useTotal ? historyTotal : lists[i].length,
      expanded: !!sectionExpanded[row.key]
    }))
  },

  _flattenMealsFromSections(mealSections) {
    const out = []
    for (let i = 0; i < (mealSections || []).length; i++) {
      const list = mealSections[i].list || []
      for (let j = 0; j < list.length; j++) out.push(list[j])
    }
    return out
  },

  _applyRawList(rawList, total, canManageMeals, resetExpand) {
    const sortMode = this.data.sortMode
    const { rawA, rawB, rawC } = this._partitionRaw(sortMode, rawList)
    const { bucket0, bucket1, bucket2 } = this._mapAndSortThreeBuckets(
      sortMode,
      rawA,
      rawB,
      rawC,
      canManageMeals
    )

    let sectionExpanded = this.data.sectionExpanded
    if (resetExpand) {
      sectionExpanded = this._computeExpandDefaults(bucket0, bucket1, bucket2, total)
    }

    const mealSections = this._buildMealSections(
      sortMode,
      bucket0,
      bucket1,
      bucket2,
      total,
      sectionExpanded
    )

    const hasAnyMeal =
      bucket0.length > 0 ||
      bucket1.length > 0 ||
      bucket2.length > 0 ||
      total > 0

    return {
      mealSections,
      sectionExpanded,
      hasAnyMeal,
      flatMeals: this._flattenMealsFromSections(mealSections)
    }
  },

  async _repartitionFromBuffer(resetExpand) {
    const currentKitchen = getApp().globalData.currentKitchen
    const kitchenId = currentKitchen ? currentKitchen.id : null
    if (!kitchenId) return

    const rawList = this.data._mealListRawBuffer || []
    const total =
      this.data.historyTotal != null ? Number(this.data.historyTotal) : rawList.length
    const role = currentKitchen && currentKitchen.role
    const canManageMeals = role === 'owner' || role === 'admin'

    const { mealSections, sectionExpanded, hasAnyMeal, flatMeals } = this._applyRawList(
      rawList,
      total,
      canManageMeals,
      resetExpand
    )

    this.setData({ mealSections, sectionExpanded, hasAnyMeal })
    this.preGenerateShareTokens(flatMeals)
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
          mealSections: [],
          hasAnyMeal: false,
          historyTotal: 0,
          historyNoMore: true,
          _mealListRawBuffer: [],
          historyPage: 1,
          historyLoading: false,
          listLoading: false
        })
        return
      }

      this.setData({ listLoading: true })

      const role = currentKitchen && currentKitchen.role
      const canManageMeals = role === 'owner' || role === 'admin'
      const listRes = await API.meal.list(null, kitchenId, {
        page: 1,
        pageSize: MEAL_LIST_PAGE_SIZE
      })

      const rawList = listRes.data.list || []
      const total =
        listRes.data.total != null ? Number(listRes.data.total) : rawList.length

      const { mealSections, sectionExpanded, hasAnyMeal, flatMeals } = this._applyRawList(
        rawList,
        total,
        canManageMeals,
        true
      )

      const fetchedAll = rawList.length >= total

      this.setData({
        _mealListRawBuffer: rawList,
        mealSections,
        sectionExpanded,
        historyPage: 1,
        historyTotal: total,
        historyLoading: false,
        historyNoMore: fetchedAll || total === 0,
        hasAnyMeal,
        listLoading: false
      })

      this.preGenerateShareTokens(flatMeals)
    } catch (err) {
      console.error('加载点餐列表失败:', err)
      this.setData({ listLoading: false })
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

      const { mealSections, sectionExpanded, flatMeals } = this._applyRawList(
        merged,
        total,
        canManageMeals,
        false
      )

      const fetchedAll = merged.length >= total || chunk.length === 0

      this.setData({
        _mealListRawBuffer: merged,
        mealSections,
        sectionExpanded,
        historyPage: nextPage,
        historyTotal: total,
        historyNoMore: fetchedAll,
        historyLoading: false
      })
      if (chunk.length > 0) {
        this.preGenerateShareTokens(flatMeals)
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

    const mealSections = (this.data.mealSections || []).map((s) => ({
      ...s,
      expanded: !!sectionExpanded[s.key]
    }))

    this.setData({ sectionExpanded, mealSections })
  },

  async preGenerateShareTokens(meals) {
    const myActiveMeals = meals.filter((m) => m.canManageMeals && m.status === 'ordering')
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
      const msg = (err && err.message) || ''
      if (msg.indexOf('达到上限') >= 0) {
        wx.showModal({
          content: '参与点餐人数达到上限，无法继续分享',
          showCancel: false
        })
      } else {
        wx.showToast({ title: '分享失败', icon: 'none' })
      }
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
