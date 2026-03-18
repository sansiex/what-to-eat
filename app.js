// app.js
const { API } = require('./utils/cloud-api.js')

App({
  onLaunch(options) {
    // 小程序启动时的初始化
    console.log('小程序启动')

    // 检查是否需要清除缓存（版本更新时）
    this.checkAndClearCache()

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

    // 检查是否需要跳转到登录页
    this.checkLoginStatus(options)
  },

  // 检查并清除缓存
  checkAndClearCache() {
    const currentVersion = '1.0.3' // 每次需要强制清除缓存时更新版本号
    const savedVersion = wx.getStorageSync('appVersion')

    if (savedVersion !== currentVersion) {
      console.log('版本更新，清除所有缓存')
      // 清除所有缓存数据
      const keysToRemove = ['openid', 'userInfo', 'currentUser', 'currentUserName', 'currentKitchen', 'kitchenOpenid']
      keysToRemove.forEach(key => {
        wx.removeStorageSync(key)
        console.log(`已清除缓存: ${key}`)
      })
      // 保存新版本号
      wx.setStorageSync('appVersion', currentVersion)
      console.log('缓存清除完成，新版本:', currentVersion)
    }
  },

  // 检查登录状态
  checkLoginStatus(options) {
    const userInfo = wx.getStorageSync('userInfo')
    console.log('检查登录状态，userInfo:', userInfo)

    const hasNickname = userInfo && userInfo.nickName && userInfo.nickName !== '微信用户'
    console.log('hasNickname:', hasNickname)

    if (!hasNickname) {
      // 未设置昵称，需要跳转到登录页
      const path = options.path || ''
      const query = options.query || {}

      // 构建原始页面的路径参数
      let redirectUrl = '/pages/menu-list/menu-list'
      if (path && path !== 'pages/login/login') {
        const queryString = Object.keys(query).map(key => `${key}=${query[key]}`).join('&')
        redirectUrl = `/${path}${queryString ? '?' + queryString : ''}`
      }

      console.log('未设置昵称，准备跳转到登录页，目标页面:', redirectUrl)

      // 延迟跳转，确保其他初始化完成
      setTimeout(() => {
        console.log('执行跳转到登录页')
        wx.navigateTo({
          url: `/pages/login/login?redirect=${encodeURIComponent(redirectUrl)}`,
          success: () => {
            console.log('跳转成功')
          },
          fail: (err) => {
            console.error('跳转失败:', err)
            // 尝试使用 redirectTo
            wx.redirectTo({
              url: `/pages/login/login?redirect=${encodeURIComponent(redirectUrl)}`
            })
          }
        })
      }, 500)
    } else {
      console.log('已设置昵称，无需跳转')
    }
  },

  // 用户登录
  login() {
    // 先检查本地存储
    const openid = wx.getStorageSync('openid')
    const userInfo = wx.getStorageSync('userInfo')

    // 如果本地已有openid和用户信息，直接返回，不再重复登录
    // 避免重复调用导致创建多个用户记录
    if (openid && userInfo) {
      console.log('使用本地存储的用户信息:', userInfo.nickName)
      return
    }

    // 调用云函数获取 openid
    wx.cloud.callFunction({
      name: 'login',
      success: res => {
        // 检查云函数返回的成功状态
        if (!res.result.success) {
          console.error('获取 openid 失败:', res.result.message)
          wx.showModal({
            title: '登录失败',
            content: res.result.message || '无法获取用户标识',
            showCancel: false
          })
          return
        }

        const openid = res.result.openid
        if (!openid) {
          console.error('获取 openid 失败: 返回值为空')
          return
        }

        // 安全检查：防止在真机调试中使用本地开发的 openid
        if (openid === 'dev_local_sansi_fixed_id') {
          console.error('错误：在真机调试中使用了本地开发的 openid')
          wx.showModal({
            title: '登录错误',
            content: '检测到使用了测试账号，请清除小程序缓存后重试',
            showCancel: false,
            success: () => {
              // 清除缓存
              wx.clearStorageSync()
              wx.showToast({ title: '请重新进入小程序', icon: 'none' })
            }
          })
          return
        }

        wx.setStorageSync('openid', openid)
        console.log('获取 openid 成功:', openid)

        // 使用默认用户信息
        const defaultName = '微信用户'
        const defaultUserInfo = { nickName: defaultName, avatarUrl: '' }
        wx.setStorageSync('userInfo', defaultUserInfo)
        wx.setStorageSync('currentUser', defaultName)
        wx.setStorageSync('currentUserName', defaultName)
        console.log('设置默认用户信息:', defaultName)

        // 同步默认用户信息到服务端
        this.syncUserInfoToServer(openid, defaultUserInfo)

        // 触发登录状态检查（因为 checkLoginStatus 可能在 login 完成前执行）
        const pages = getCurrentPages()
        if (pages.length > 0) {
          const currentPage = pages[pages.length - 1]
          console.log('当前页面:', currentPage.route)
          if (currentPage.route !== 'pages/login/login') {
            this.checkLoginStatus({ path: currentPage.route, query: currentPage.options || {} })
          }
        }
      },
      fail: err => {
        console.error('获取 openid 失败:', err)
      }
    })
  },

  // 同步用户信息到服务端
  async syncUserInfoToServer(openid, userInfo) {
    if (!openid) {
      console.error('同步用户信息失败: openid 为空')
      return
    }

    // 安全检查：防止使用本地开发的 openid
    if (openid === 'dev_local_sansi_fixed_id') {
      console.error('错误：尝试使用本地开发的 openid 同步用户信息')
      return
    }

    try {
      const result = await API.user.login(openid, userInfo)
      if (result.success) {
        console.log('用户信息同步到服务端成功:', result.data)
      } else {
        console.error('用户信息同步到服务端失败:', result.message)
      }
    } catch (err) {
      console.error('同步用户信息到服务端失败:', err)
    }
  },

  // 获取用户信息（需要用户点击触发）
  getUserProfile(callback) {
    wx.getUserProfile({
      desc: '用于展示用户昵称',
      success: res => {
        const userInfo = res.userInfo
        wx.setStorageSync('userInfo', userInfo)
        wx.setStorageSync('currentUser', userInfo.nickName)
        wx.setStorageSync('currentUserName', userInfo.nickName)
        console.log('获取用户信息成功:', userInfo.nickName)

        // 同步到服务端
        const openid = wx.getStorageSync('openid')
        if (openid) {
          this.syncUserInfoToServer(openid, userInfo)
        }

        if (callback) callback(userInfo)
      },
      fail: err => {
        console.log('获取用户信息失败:', err)
        if (callback) callback(null)
      }
    })
  },

  // 初始化默认厨房
  async initDefaultKitchen() {
    try {
      // 获取当前用户的openid
      const openid = wx.getStorageSync('openid')
      console.log('initDefaultKitchen: openid=', openid)
      if (!openid) {
        console.log('用户未登录，跳过初始化默认厨房')
        return null
      }

      // 检查本地存储的厨房是否属于当前用户（通过比较openid）
      const savedKitchen = wx.getStorageSync('currentKitchen')
      const savedOpenid = wx.getStorageSync('kitchenOpenid')
      console.log('initDefaultKitchen: savedKitchen=', savedKitchen, 'savedOpenid=', savedOpenid)
      
      if (savedKitchen && savedOpenid === openid) {
        this.globalData.currentKitchen = savedKitchen
        console.log('从本地存储恢复默认厨房:', savedKitchen.name)
        return savedKitchen
      }

      // 清除之前用户的厨房缓存
      if (savedKitchen && savedOpenid !== openid) {
        console.log('厨房缓存属于其他用户，清除缓存')
        wx.removeStorageSync('currentKitchen')
        wx.removeStorageSync('kitchenOpenid')
      }

      // 调用云函数获取或创建默认厨房
      console.log('initDefaultKitchen: 调用云函数 getOrCreateDefault')
      const result = await API.kitchen.getOrCreateDefault()
      console.log('initDefaultKitchen: 云函数返回结果=', result)
      if (result.success) {
        this.globalData.currentKitchen = result.data
        wx.setStorageSync('currentKitchen', result.data)
        wx.setStorageSync('kitchenOpenid', openid)
        console.log('默认厨房:', result.data.name)
        return result.data
      } else {
        console.error('initDefaultKitchen: 云函数返回失败:', result.message)
      }
    } catch (err) {
      console.error('初始化默认厨房失败:', err)
      // 如果云函数调用失败，返回null
      return null
    }
  },

  // 更新用户信息（用于昵称输入组件）
  updateUserInfo(nickName, avatarUrl = '') {
    const userInfo = { nickName, avatarUrl }
    wx.setStorageSync('userInfo', userInfo)
    wx.setStorageSync('currentUser', nickName)
    wx.setStorageSync('currentUserName', nickName)
    
    const openid = wx.getStorageSync('openid')
    if (openid) {
      this.syncUserInfoToServer(openid, userInfo)
    }
  },

  globalData: {
    currentMeal: null,
    editingMeal: null,
    currentKitchen: null
  }
})
