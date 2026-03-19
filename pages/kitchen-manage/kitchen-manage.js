// pages/kitchen-manage/kitchen-manage.js
const { API } = require('../../utils/cloud-api.js')

Page({
  data: {
    kitchenId: null,
    kitchenName: '',
    originalName: '',
    members: [],
    inviteToken: ''
  },

  onLoad(options) {
    const kitchenId = parseInt(options.kitchenId)
    if (!kitchenId) {
      wx.showToast({ title: '参数错误', icon: 'none' })
      return
    }

    // Immediately populate from globalData to avoid blank input
    const currentKitchen = getApp().globalData.currentKitchen
    const initialName = (currentKitchen && currentKitchen.id === kitchenId)
      ? currentKitchen.name
      : ''

    this.setData({
      kitchenId,
      kitchenName: initialName,
      originalName: initialName
    })

    this.loadKitchenInfo()
    this.loadMembers()
    this.preGenerateInviteToken()
  },

  async loadKitchenInfo() {
    try {
      const result = await API.kitchen.get(this.data.kitchenId)
      if (result.success) {
        this.setData({
          kitchenName: result.data.name,
          originalName: result.data.name
        })
      }
    } catch (err) {
      console.error('加载厨房信息失败:', err)
    }
  },

  async loadMembers() {
    try {
      const result = await API.kitchen.listMembers(this.data.kitchenId)
      if (result.success) {
        this.setData({ members: result.data.list || [] })
      }
    } catch (err) {
      console.error('加载成员列表失败:', err)
    }
  },

  async preGenerateInviteToken() {
    try {
      const result = await API.kitchen.generateInvite(this.data.kitchenId)
      if (result.success) {
        this.setData({ inviteToken: result.data.token })
      }
    } catch (err) {
      console.warn('预生成邀请令牌失败:', err)
    }
  },

  onNameInput(e) {
    this.setData({ kitchenName: e.detail.value })
  },

  async saveName() {
    const { kitchenId, kitchenName } = this.data
    if (!kitchenName.trim()) {
      wx.showToast({ title: '名称不能为空', icon: 'none' })
      return
    }
    try {
      await API.kitchen.update(kitchenId, kitchenName.trim())
      this.setData({ originalName: kitchenName.trim() })
      wx.showToast({ title: '已保存', icon: 'success' })
    } catch (err) {
      console.error('保存名称失败:', err)
    }
  },

  removeMember(e) {
    const memberId = e.currentTarget.dataset.id
    const memberName = e.currentTarget.dataset.name || '该成员'

    wx.showModal({
      title: '确认移除',
      content: `确定移除「${memberName}」的管理员权限？`,
      success: async (res) => {
        if (!res.confirm) return
        try {
          await API.kitchen.removeMember(this.data.kitchenId, memberId)
          wx.showToast({ title: '已移除', icon: 'success' })
          this.loadMembers()
        } catch (err) {
          console.error('移除成员失败:', err)
        }
      }
    })
  },

  onShareAppMessage() {
    const { kitchenId, kitchenName, inviteToken } = this.data
    const userInfo = wx.getStorageSync('userInfo') || {}
    const ownerName = userInfo.nickName || '你的好友'

    const path = inviteToken
      ? `/pages/kitchen-invite/kitchen-invite?token=${inviteToken}&kitchenId=${kitchenId}`
      : `/pages/kitchen-invite/kitchen-invite?kitchenId=${kitchenId}`

    return {
      title: `${ownerName}邀请你一起管理「${kitchenName}」`,
      path,
      imageUrl: '/images/share_card.jpg'
    }
  }
})
