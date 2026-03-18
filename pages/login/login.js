// pages/login/login.js
Page({
  data: {
    nickName: '',
    redirectUrl: ''
  },

  onLoad(options) {
    // 获取需要跳转的目标页面
    const redirectUrl = options.redirect || '/pages/menu-list/menu-list'
    this.setData({ redirectUrl })

    // 检查是否已登录
    const userInfo = wx.getStorageSync('userInfo')
    if (userInfo && userInfo.nickName && userInfo.nickName !== '微信用户') {
      // 已设置昵称，直接跳转
      wx.switchTab({
        url: redirectUrl,
        fail: () => {
          // 如果不是 tab 页面，使用 navigateTo
          wx.navigateTo({ url: redirectUrl })
        }
      })
    }
  },

  // 昵称输入处理
  onNicknameInput(e) {
    this.setData({
      nickName: e.detail.value
    })
  },

  // 昵称变更处理（失去焦点时）
  onNicknameChange(e) {
    const nickName = e.detail.value
    if (nickName) {
      this.setData({ nickName })
    }
  },

  // 登录/确认
  onLogin() {
    const { nickName, redirectUrl } = this.data
    
    console.log('点击开始使用，nickName:', nickName, 'redirectUrl:', redirectUrl)

    if (!nickName || nickName.trim() === '') {
      wx.showToast({
        title: '请输入昵称',
        icon: 'none'
      })
      return
    }

    // 保存用户信息
    const userInfo = {
      nickName: nickName.trim(),
      avatarUrl: ''
    }
    wx.setStorageSync('userInfo', userInfo)
    wx.setStorageSync('currentUser', userInfo.nickName)
    wx.setStorageSync('currentUserName', userInfo.nickName)
    console.log('用户信息已保存:', userInfo)

    // 清除之前用户的厨房缓存，确保新用户获取自己的默认厨房
    wx.removeStorageSync('currentKitchen')
    console.log('已清除厨房缓存')

    // 同步到服务端
    const openid = wx.getStorageSync('openid')
    if (openid) {
      getApp().syncUserInfoToServer(openid, userInfo)
    }

    wx.showToast({
      title: '设置成功',
      icon: 'success',
      duration: 1500,
      success: () => {
        console.log('准备跳转，目标:', redirectUrl)
        // 延迟跳转
        setTimeout(() => {
          // 解码 URL
          const decodedUrl = decodeURIComponent(redirectUrl)
          console.log('解码后的 URL:', decodedUrl)
          
          // 判断是否是 tab 页面
          const tabPages = ['/pages/menu-list/menu-list', '/pages/dish-list/dish-list', '/pages/meal-list/meal-list']
          const isTabPage = tabPages.some(tab => decodedUrl.startsWith(tab))
          
          if (isTabPage) {
            console.log('跳转到 tab 页面:', decodedUrl)
            wx.switchTab({
              url: decodedUrl,
              success: () => {
                console.log('跳转成功')
              },
              fail: (err) => {
                console.error('跳转失败:', err)
                // 尝试跳转到首页
                wx.switchTab({ url: '/pages/menu-list/menu-list' })
              }
            })
          } else {
            console.log('跳转到普通页面:', decodedUrl)
            wx.navigateTo({
              url: decodedUrl,
              success: () => {
                console.log('跳转成功')
              },
              fail: (err) => {
                console.error('跳转失败:', err)
                // 尝试跳转到首页
                wx.switchTab({ url: '/pages/menu-list/menu-list' })
              }
            })
          }
        }, 1500)
      }
    })
  }
})
