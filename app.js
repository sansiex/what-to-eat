// app.js
const { API } = require('./utils/cloud-api.js')

App({
  onLaunch() {
    // 小程序启动时的初始化
    console.log('小程序启动')

    // 初始化云开发环境
    wx.cloud.init({
      env: 'dev-0gtpuq9p785f5498',
      traceUser: true
    })
    console.log('云开发环境初始化完成')

    // 获取用户登录信息
    this.login()

    // 初始化默认厨房
    this.initDefaultKitchen()
  },

  // 用户登录
  login() {
    // 先检查本地存储
    const openid = wx.getStorageSync('openid')
    const userInfo = wx.getStorageSync('userInfo')

    if (openid && userInfo) {
      console.log('使用本地存储的用户信息:', userInfo.nickName)
      return
    }

    // 调用云函数获取 openid
    wx.cloud.callFunction({
      name: 'login',
      success: res => {
        const openid = res.result.openid
        wx.setStorageSync('openid', openid)
        console.log('获取 openid 成功:', openid)

        // 使用默认用户信息（不自动调用 getUserProfile，需要用户主动触发）
        const defaultName = '微信用户'
        const defaultUserInfo = { nickName: defaultName }
        wx.setStorageSync('userInfo', defaultUserInfo)
        wx.setStorageSync('currentUser', defaultName)
        wx.setStorageSync('currentUserName', defaultName)
        console.log('使用默认用户信息')
      },
      fail: err => {
        console.error('获取 openid 失败:', err)
      }
    })
  },

  // 初始化默认厨房
  async initDefaultKitchen() {
    try {
      // 检查是否已有默认厨房
      if (this.globalData.currentKitchen) {
        console.log('已有默认厨房:', this.globalData.currentKitchen.name)
        return this.globalData.currentKitchen
      }

      // 检查本地存储
      const savedKitchen = wx.getStorageSync('currentKitchen')
      if (savedKitchen) {
        this.globalData.currentKitchen = savedKitchen
        console.log('从本地存储恢复默认厨房:', savedKitchen.name)
        return savedKitchen
      }

      // 调用云函数获取或创建默认厨房
      const result = await API.kitchen.getOrCreateDefault()
      if (result.success) {
        this.globalData.currentKitchen = result.data
        wx.setStorageSync('currentKitchen', result.data)
        console.log('默认厨房:', result.data.name)
        return result.data
      }
    } catch (err) {
      console.error('初始化默认厨房失败:', err)
      // 如果云函数调用失败，使用本地默认厨房
      const defaultKitchen = { id: 1, name: '我的厨房', is_default: 1 }
      this.globalData.currentKitchen = defaultKitchen
      console.log('使用本地默认厨房:', defaultKitchen.name)
      return defaultKitchen
    }
  },

  // 获取用户信息
  getUserProfile() {
    wx.getUserProfile({
      desc: '用于展示用户昵称',
      success: res => {
        const userInfo = res.userInfo
        wx.setStorageSync('userInfo', userInfo)
        wx.setStorageSync('currentUser', userInfo.nickName)
        wx.setStorageSync('currentUserName', userInfo.nickName)
        console.log('获取用户信息成功:', userInfo.nickName)
      },
      fail: err => {
        console.log('获取用户信息失败:', err)
        // 使用默认用户名
        const defaultName = '微信用户'
        wx.setStorageSync('userInfo', { nickName: defaultName })
        wx.setStorageSync('currentUser', defaultName)
        wx.setStorageSync('currentUserName', defaultName)
      }
    })
  },

  globalData: {
    currentMeal: null,
    editingMeal: null,
    currentKitchen: null
  }
})
