// components/kitchen-switcher/kitchen-switcher.js
const { API } = require('../../utils/cloud-api.js')

Component({
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
      wx.navigateTo({
        url: `/pages/kitchen-manage/kitchen-manage?kitchenId=${currentKitchen.id}`
      })
    },

    leaveCurrentKitchen() {
      const { currentKitchen, kitchenList } = this.data
      wx.showModal({
        title: '确认退出',
        content: `确定退出「${currentKitchen.name}」的厨房？退出后将无法管理该厨房的菜品和菜单。`,
        success: async (res) => {
          if (!res.confirm) return
          try {
            await API.kitchen.leaveKitchen(currentKitchen.id)
            wx.showToast({ title: '已退出', icon: 'success' })

            // Remove from list and switch to first owned kitchen
            const newList = kitchenList.filter(k => k.id !== currentKitchen.id)
            this.setData({ kitchenList: newList, showPanel: false })

            const ownedKitchen = newList.find(k => k.role === 'owner') || newList[0]
            if (ownedKitchen) {
              this.setCurrentKitchen(ownedKitchen, true)
            }
          } catch (err) {
            console.error('退出厨房失败:', err)
          }
        }
      })
    },

    reload() {
      this.loadKitchens()
    }
  }
})
