// components/kitchen-switcher/kitchen-switcher.js
const { API } = require('../../utils/cloud-api.js')

Component({
  properties: {
    /** 为 false 时隐藏顶部条，仅保留下拉面板，由页面调用 openPanel() 打开 */
    showBar: {
      type: Boolean,
      value: true
    }
  },

  data: {
    showPanel: false,
    kitchenList: [],
    currentKitchen: {}
  },

  lifetimes: {
    attached() {
      this.loadKitchens()
    }
  },

  pageLifetimes: {
    show() {
      this.refreshCurrentKitchen()
    }
  },

  methods: {
    async loadKitchens() {
      try {
        const result = await API.kitchen.listAccessible()
        const list = result.data.list || []
        this.setData({ kitchenList: list })

        // Determine current kitchen
        const savedId = wx.getStorageSync('lastKitchenId')
        const app = getApp()
        let current = null

        if (savedId) {
          current = list.find(k => k.id === savedId)
        }
        if (!current && app.globalData.currentKitchen) {
          current = list.find(k => k.id === app.globalData.currentKitchen.id)
        }
        if (!current && list.length > 0) {
          current = list[0]
        }

        if (current) {
          this.setCurrentKitchen(current, false)
        }
      } catch (err) {
        console.error('加载厨房列表失败:', err)
        // Fallback to globalData
        const app = getApp()
        if (app.globalData.currentKitchen) {
          this.setData({
            currentKitchen: {
              ...app.globalData.currentKitchen,
              role: 'owner'
            }
          })
        }
      }
    },

    refreshCurrentKitchen() {
      const { kitchenList } = this.data
      const savedId = wx.getStorageSync('lastKitchenId')
      if (savedId && kitchenList.length > 0) {
        const found = kitchenList.find(k => k.id === savedId)
        if (found && found.id !== this.data.currentKitchen.id) {
          this.setCurrentKitchen(found, false)
        }
      }
    },

    setCurrentKitchen(kitchen, triggerReload = true) {
      const app = getApp()
      app.globalData.currentKitchen = kitchen
      wx.setStorageSync('lastKitchenId', kitchen.id)
      wx.setStorageSync('currentKitchen', kitchen)
      wx.setStorageSync('kitchenOpenid', wx.getStorageSync('openid'))

      this.setData({ currentKitchen: kitchen })

      if (triggerReload) {
        this.triggerEvent('kitchenchange', { kitchen })
      }
    },

    togglePanel() {
      this.setData({ showPanel: !this.data.showPanel })
    },

    /** 仅面板模式：加载列表并展开（与顶部「选择厨房」下拉一致） */
    openPanel() {
      this.loadKitchens()
        .then(() => {
          this.setData({ showPanel: true })
        })
        .catch(() => {
          this.setData({ showPanel: true })
        })
    },

    selectKitchen(e) {
      const kitchen = e.currentTarget.dataset.kitchen
      if (kitchen.id === this.data.currentKitchen.id) {
        this.setData({ showPanel: false })
        return
      }
      this.setCurrentKitchen(kitchen, true)
      this.setData({ showPanel: false })
    },

    goManage() {
      const { currentKitchen } = this.data
      if (currentKitchen.role !== 'owner') return
      wx.switchTab({
        url: '/pages/kitchen-manage/kitchen-manage'
      })
    },

    reload() {
      this.loadKitchens()
    }
  }
})
