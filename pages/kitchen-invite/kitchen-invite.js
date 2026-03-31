// pages/kitchen-invite/kitchen-invite.js
const { API } = require('../../utils/cloud-api.js')
const { showExitOrEnterKitchenModal, ADMIN_LIMIT_MSG } = require('../../utils/enter-my-kitchen.js')

Page({
  data: {
    loading: true,
    expired: false,
    errorMessage: '',
    inviteInfo: null,
    token: '',
    kitchenId: null,
    joining: false
  },

  onLoad(options) {
    const { token, kitchenId } = options
    if (!token) {
      this.setData({
        loading: false,
        expired: true,
        errorMessage: '邀请链接无效'
      })
      return
    }

    this.setData({ token, kitchenId: parseInt(kitchenId) })
    this.loadInviteInfo()
  },

  async loadInviteInfo() {
    try {
      const result = await API.kitchen.getInviteInfo(this.data.token)
      if (result.success) {
        const info = result.data
        this.setData({
          loading: false,
          inviteInfo: info
        })
        if (info.adminLimitReached && !info.isAlreadyMember) {
          showExitOrEnterKitchenModal(ADMIN_LIMIT_MSG)
        }
      } else {
        this.setData({
          loading: false,
          expired: true,
          errorMessage: result.message || '邀请链接已失效'
        })
      }
    } catch (err) {
      console.error('获取邀请信息失败:', err)
      this.setData({
        loading: false,
        expired: true,
        errorMessage: '邀请链接已失效'
      })
    }
  },

  async acceptInvite() {
    if (this.data.joining) return
    this.setData({ joining: true })

    try {
      const result = await API.kitchen.acceptInvite(this.data.token)
      if (result.success) {
        wx.showToast({ title: '加入成功！', icon: 'success' })

        // Switch to the joined kitchen
        const kitchen = {
          id: result.data.kitchenId,
          name: result.data.kitchenName,
          role: 'admin'
        }
        getApp().globalData.currentKitchen = kitchen
        wx.setStorageSync('lastKitchenId', kitchen.id)
        wx.setStorageSync('currentKitchen', kitchen)

        setTimeout(() => {
          wx.switchTab({ url: '/pages/menu-list/menu-list' })
        }, 1000)
      }
    } catch (err) {
      console.error('加入厨房失败:', err)
      const msg = (err && err.message) || ''
      if (msg.indexOf('管理员') >= 0 && msg.indexOf('上限') >= 0) {
        showExitOrEnterKitchenModal(ADMIN_LIMIT_MSG)
      }
    } finally {
      this.setData({ joining: false })
    }
  },

  enterKitchen() {
    const { inviteInfo } = this.data
    if (!inviteInfo) return

    const kitchen = {
      id: inviteInfo.kitchenId,
      name: inviteInfo.kitchenName,
      role: inviteInfo.memberRole
    }
    getApp().globalData.currentKitchen = kitchen
    wx.setStorageSync('lastKitchenId', kitchen.id)
    wx.setStorageSync('currentKitchen', kitchen)

    wx.switchTab({ url: '/pages/menu-list/menu-list' })
  },

  goHome() {
    wx.switchTab({ url: '/pages/menu-list/menu-list' })
  }
})
