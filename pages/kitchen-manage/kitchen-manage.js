// pages/kitchen-manage/kitchen-manage.js
const { API } = require('../../utils/cloud-api.js')

Page({
  data: {
    kitchenId: null,
    kitchenName: '',
    originalName: '',
    /** 是否为当前厨房主人（非主人不可改名称、不可邀请/移除管理员） */
    isOwner: false,
    /** 与选择厨房面板一致：主人 / 管理员 */
    roleLabel: '',
    /** 管理员时展示：「主人昵称 的厨房」，与 panel__owner 一致 */
    kitchenMetaSubtitle: '',
    members: [],
    membersLoading: false,
    inviteToken: ''
  },

  onShow() {
    this.bootstrapPage()
  },

  bootstrapPage() {
    const current = getApp().globalData.currentKitchen
    if (!current || !current.id) {
      wx.showToast({ title: '暂无厨房，请稍后重试', icon: 'none' })
      return
    }

    const isOwner = current.role === 'owner'
    const kitchenId = current.id
    const changedKitchen = this.data.kitchenId !== kitchenId

    const roleLabel = current.role === 'admin' ? '管理员' : '主人'
    let kitchenMetaSubtitle = ''
    if (current.role === 'admin') {
      const on = current.ownerName
      kitchenMetaSubtitle = on ? `${on} 的厨房` : ''
    }

    this.setData({
      kitchenId,
      isOwner,
      roleLabel,
      kitchenMetaSubtitle
    })

    if (current.role === 'admin' && !current.ownerName) {
      this.ensureAdminOwnerSubtitle()
    }

    if (changedKitchen || !this.data.originalName) {
      this.setData({
        kitchenName: current.name || '',
        originalName: current.name || ''
      })
    }

    this.loadKitchenInfo()
    this.loadMembers()
    if (isOwner) {
      this.preGenerateInviteToken()
    }
  },

  /** 管理员且 globalData 缺少 ownerName 时，从 listAccessible 补全副标题 */
  async ensureAdminOwnerSubtitle() {
    const { kitchenId } = this.data
    const app = getApp()
    const current = app.globalData.currentKitchen
    if (!kitchenId || !current || current.role !== 'admin') return
    if (current.ownerName) {
      this.setData({
        kitchenMetaSubtitle: `${current.ownerName} 的厨房`
      })
      return
    }
    try {
      const result = await API.kitchen.listAccessible()
      const list = (result.data && result.data.list) || []
      const found = list.find(k => k.id === kitchenId)
      if (found && found.ownerName) {
        app.globalData.currentKitchen = { ...current, ownerName: found.ownerName }
        wx.setStorageSync('currentKitchen', app.globalData.currentKitchen)
        this.setData({
          kitchenMetaSubtitle: `${found.ownerName} 的厨房`
        })
      }
    } catch (e) {
      console.warn('补全厨房主人昵称失败:', e)
    }
  },

  openKitchenPicker() {
    const comp = this.selectComponent('#kitchenSwitcher')
    if (comp && typeof comp.openPanel === 'function') {
      comp.openPanel()
    }
  },

  onKitchenChange() {
    this.bootstrapPage()
  },

  async loadKitchenInfo() {
    const { kitchenId } = this.data
    const current = getApp().globalData.currentKitchen
    try {
      const result = await API.kitchen.get(kitchenId)
      if (result.success && result.data) {
        this.setData({
          kitchenName: result.data.name,
          originalName: result.data.name
        })
        return
      }
    } catch (err) {
      console.warn('加载厨房信息（可能非主人无 get 权限）:', err)
    }
    if (current && current.id === kitchenId) {
      this.setData({
        kitchenName: current.name,
        originalName: current.name
      })
    }
  },

  formatBeijingTime(isoString) {
    if (!isoString) return ''
    try {
      const date = new Date(isoString)
      const beijingTime = new Date(date.getTime() + 8 * 60 * 60 * 1000)
      const year = beijingTime.getUTCFullYear()
      const month = String(beijingTime.getUTCMonth() + 1).padStart(2, '0')
      const day = String(beijingTime.getUTCDate()).padStart(2, '0')
      const hours = String(beijingTime.getUTCHours()).padStart(2, '0')
      const minutes = String(beijingTime.getUTCMinutes()).padStart(2, '0')
      return `${year}-${month}-${day} ${hours}:${minutes}`
    } catch (e) {
      return ''
    }
  },

  async loadMembers() {
    this.setData({ membersLoading: true })
    try {
      const result = await API.kitchen.listMembers(this.data.kitchenId)
      if (result.success) {
        const list = (result.data.list || []).map(m => ({
          ...m,
          joinedAt: this.formatBeijingTime(m.joinedAt)
        }))
        this.setData({ members: list, membersLoading: false })
      } else {
        this.setData({ membersLoading: false })
      }
    } catch (err) {
      console.error('加载成员列表失败:', err)
      this.setData({ membersLoading: false })
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
      const msg = (err && err.message) || ''
      if (msg.indexOf('管理员数量') >= 0 || msg.indexOf('上限') >= 0) {
        wx.showModal({
          content: '管理员数量已达到上限，无法继续邀请管理员。',
          showCancel: false
        })
      }
    }
  },

  onNameInput(e) {
    if (!this.data.isOwner) return
    this.setData({ kitchenName: e.detail.value })
  },

  async saveName() {
    const { kitchenId, kitchenName, isOwner } = this.data
    if (!isOwner) return
    if (!kitchenName.trim()) {
      wx.showToast({ title: '名称不能为空', icon: 'none' })
      return
    }
    try {
      await API.kitchen.update(kitchenId, kitchenName.trim())
      this.setData({ originalName: kitchenName.trim() })
      const app = getApp()
      if (app.globalData.currentKitchen && app.globalData.currentKitchen.id === kitchenId) {
        app.globalData.currentKitchen.name = kitchenName.trim()
        wx.setStorageSync('currentKitchen', app.globalData.currentKitchen)
      }
      wx.showToast({ title: '已保存', icon: 'success' })
    } catch (err) {
      console.error('保存名称失败:', err)
    }
  },

  removeMember(e) {
    if (!this.data.isOwner) return
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
    const { kitchenId, kitchenName, inviteToken, isOwner } = this.data
    if (!isOwner) {
      return {
        title: '今天吃什么？一起来点餐吧！',
        path: '/pages/meal-list/meal-list'
      }
    }
    const userInfo = wx.getStorageSync('userInfo') || {}
    const ownerName = userInfo.nickName || '你的好友'

    const path = inviteToken
      ? `/pages/kitchen-invite/kitchen-invite?token=${inviteToken}&kitchenId=${kitchenId}`
      : `/pages/kitchen-invite/kitchen-invite?kitchenId=${kitchenId}`

    return {
      title: `${ownerName}邀请你一起管理「${kitchenName}」`,
      path,
      imageUrl: '/images/join_my_kitchen.jpg'
    }
  }
})
