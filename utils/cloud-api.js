/**
 * 云函数调用工具类
 * 使用 HTTP API 调用腾讯云 CloudBase 云函数
 */

// CloudBase HTTP API 基础地址
const BASE_URL = 'https://dev-0gtpuq9p785f5498.api.tcloudbasegateway.com/v1/functions'

// API Key（从腾讯云控制台获取）
const API_KEY = 'eyJhbGciOiJSUzI1NiIsImtpZCI6IjlkMWRjMzFlLWI0ZDAtNDQ4Yi1hNzZmLWIwY2M2M2Q4MTQ5OCJ9.eyJhdWQiOiJkZXYtMGd0cHVxOXA3ODVmNTQ5OCIsImV4cCI6MjUzNDAyMzAwNzk5LCJpYXQiOjE3NzIyMTI2OTQsImF0X2hhc2giOiJuVDVqeHZIdlQ4QzZ3Z1VKU1A0ZFpBIiwicHJvamVjdF9pZCI6ImRldi0wZ3RwdXE5cDc4NWY1NDk4IiwibWV0YSI6eyJwbGF0Zm9ybSI6IkFwaUtleSJ9LCJhZG1pbmlzdHJhdG9yX2lkIjoiMjAyNTkxMDY3MTUwMzcyMDQ0OSIsInVzZXJfdHlwZSI6IiIsImNsaWVudF90eXBlIjoiY2xpZW50X3NlcnZlciIsImlzX3N5c3RlbV9hZG1pbiI6dHJ1ZX0.ki7m1_sdr3EcOOZxXf2WSqIdRBK0sKidLhsiRoqXtLMlW9QEKlvUlFMaISutl9reifOlrwVchjLMg5ufb_Pv4H-rd1ART_Fldq0rT6PEETtFBJycVdl0C1WZI3nlt9CbvW9EyGT6aNnnDtZzduSH8gpxS2sUB6to7n-mpsxplQ4eOy4QXGYynD4sAwOPDXOyI0cNXy3BwmAsMDPTcI4X-Kno4Y7XaOgOwiOSCW4odznuo671FZjU6MEybrEmhdDuCYZX5JiX4liWiM-nHg5_yu_WcsRgVd5coRgJvmwiyfwa9Xa9p1QSEFw6bgs1nvrJwZ2QNFRGBccqUEX1JrjCEA'

const API = {
  // 菜品管理
  dish: {
    // 获取菜品列表
    list(kitchenId = null, keyword = '') {
      const data = { keyword }
      if (kitchenId) {
        data.kitchenId = kitchenId
      }
      return callHttpFunction('dish', 'list', data)
    },

    // 创建菜品（kitchenId 不传时后端使用用户默认厨房）
    create(name, description = '', imageUrl = '', kitchenId = null) {
      const data = { name, description: description || '', imageUrl: imageUrl || '' }
      if (kitchenId != null && kitchenId !== '') {
        data.kitchenId = kitchenId
      }
      return callHttpFunction('dish', 'create', data)
    },

    // 更新菜品
    update(id, name, description = '', imageUrl = '') {
      return callHttpFunction('dish', 'update', { id, name, description, imageUrl })
    },

    // 删除菜品
    delete(id) {
      return callHttpFunction('dish', 'delete', { id })
    },

    // 获取单个菜品
    get(id) {
      return callHttpFunction('dish', 'get', { id })
    }
  },

  // 点餐管理
  meal: {
    list(status = null, kitchenId = null, extra = {}) {
      const data = { ...extra }
      if (status !== null && status !== undefined) data.status = status
      if (kitchenId !== null && kitchenId !== undefined) data.kitchenId = kitchenId
      return callHttpFunction('meal', 'list', data)
    },

    // 创建点餐（kitchenId 不传时后端使用用户默认厨房，需与点餐列表 currentKitchen 一致）
    // schedule 可选：{ scheduledDate, scheduledTimeSpecified, scheduledHour, scheduledMinute }
    create(name, dishIds, kitchenId = null, schedule = null) {
      const data = { name, dishIds }
      if (kitchenId != null && kitchenId !== '') {
        data.kitchenId = kitchenId
      }
      if (schedule && typeof schedule === 'object') {
        Object.assign(data, schedule)
      }
      return callHttpFunction('meal', 'create', data)
    },

    // 更新点餐；schedule 同 create，编辑页传入则会更新用餐时间
    update(id, name, dishIds, schedule = null) {
      const data = { id, name, dishIds }
      if (schedule && typeof schedule === 'object') {
        Object.assign(data, schedule)
      }
      return callHttpFunction('meal', 'update', data)
    },

    // 删除点餐
    delete(id) {
      return callHttpFunction('meal', 'delete', { id })
    },

    // 获取单个点餐
    get(id) {
      return callHttpFunction('meal', 'get', { id })
    },

    // 收单
    close(id) {
      return callHttpFunction('meal', 'close', { id })
    },

    // 恢复点餐（将已收单的点餐恢复为点餐中状态）
    reopen(id) {
      return callHttpFunction('meal', 'reopen', { id })
    },

    /** 记录当前用户参与点餐（非厨房人员计入 15 人上限） */
    recordParticipant(mealId) {
      return callHttpFunction('meal', 'recordParticipant', { mealId })
    }
  },

  // 订单管理
  order: {
    // 创建订单（下单）；dishTagsByDishId 可选：{ [dishId]: [{ categoryKey, tagCode }] }，与勾选一并提交
    create(mealId, dishIds, dishTagsByDishId) {
      const data = { mealId, dishIds }
      if (dishTagsByDishId != null) data.dishTagsByDishId = dishTagsByDishId
      return callHttpFunction('order', 'create', data)
    },

    // 取消订单
    cancel(mealId) {
      return callHttpFunction('order', 'cancel', { mealId })
    },

    // 获取点餐的订单统计
    listByMeal(mealId) {
      return callHttpFunction('order', 'listByMeal', { mealId })
    },

    // 获取用户的订单历史
    listByUser(page = 1, pageSize = 20) {
      return callHttpFunction('order', 'listByUser', { page, pageSize })
    },

    // 获取我在某个点餐中的订单
    getMyOrder(mealId) {
      return callHttpFunction('order', 'getMyOrder', { mealId })
    },

    /** tags: [{ categoryKey, tagCode }] */
    addDishTags(mealId, dishId, tags) {
      return callHttpFunction('order', 'addDishTags', { mealId, dishId, tags })
    },

    removeDishTag(mealId, dishId, categoryKey, tagCode) {
      return callHttpFunction('order', 'removeDishTag', { mealId, dishId, categoryKey, tagCode })
    },

    listMealDishTags(mealId) {
      return callHttpFunction('order', 'listMealDishTags', { mealId })
    }
  },

  // 用户管理
  user: {
    // 登录
    // 支持传入 code 或 openid
    login(codeOrOpenid, userInfo = null) {
      // 判断是 openid 还是 code（openid 通常包含下划线或更长）
      const isOpenid = codeOrOpenid && (codeOrOpenid.includes('_') || codeOrOpenid.length > 32)
      const params = isOpenid
        ? { openid: codeOrOpenid, userInfo }
        : { code: codeOrOpenid, userInfo }
      return callHttpFunction('user', 'login', params)
    },

    // 获取用户信息
    get() {
      return callHttpFunction('user', 'get')
    },

    // 更新用户信息
    update(nickname, avatarUrl) {
      return callHttpFunction('user', 'update', { nickname, avatarUrl })
    }
  },

  // 菜单管理
  menu: {
    // 获取菜单列表
    list(kitchenId) {
      return callLocalFunction('menu', 'list', { kitchenId })
    },

    // 创建菜单
    create(data) {
      return callLocalFunction('menu', 'create', data)
    },

    // 更新菜单
    update(data) {
      return callLocalFunction('menu', 'update', data)
    },

    // 删除菜单（软删除）
    delete(id) {
      return callLocalFunction('menu', 'delete', { id })
    },

    // 获取单个菜单
    get(id) {
      return callLocalFunction('menu', 'get', { id })
    }
  },

  // 厨房管理
  kitchen: {
    list() {
      return callLocalFunction('kitchen', 'list')
    },

    create(name) {
      return callLocalFunction('kitchen', 'create', { name })
    },

    update(id, name) {
      return callLocalFunction('kitchen', 'update', { id, name })
    },

    delete(id) {
      return callLocalFunction('kitchen', 'delete', { id })
    },

    setDefault(id) {
      return callLocalFunction('kitchen', 'setDefault', { id })
    },

    get(id) {
      return callLocalFunction('kitchen', 'get', { id })
    },

    getOrCreateDefault() {
      return callLocalFunction('kitchen', 'getOrCreateDefault')
    },

    listAccessible() {
      return callLocalFunction('kitchen', 'listAccessible')
    },

    listMembers(kitchenId) {
      return callLocalFunction('kitchen', 'listMembers', { kitchenId })
    },

    removeMember(kitchenId, memberId) {
      return callLocalFunction('kitchen', 'removeMember', { kitchenId, memberId })
    },

    leaveKitchen(kitchenId) {
      return callLocalFunction('kitchen', 'leaveKitchen', { kitchenId })
    },

    generateInvite(kitchenId) {
      return callLocalFunction('kitchen', 'generateInvite', { kitchenId })
    },

    getInviteInfo(token) {
      return callLocalFunction('kitchen', 'getInviteInfo', { token })
    },

    acceptInvite(token) {
      return callLocalFunction('kitchen', 'acceptInvite', { token })
    }
  },

  // 分享功能
  share: {
    // 生成分享链接
    generateShareLink(mealId) {
      return callHttpFunction('meal', 'generateShareLink', { mealId })
    },

    // 通过分享令牌获取点餐详情
    getByShareToken(shareToken, mealId) {
      return callHttpFunction('meal', 'getByShareToken', { shareToken, mealId })
    }
  },

  // 匿名订单
  anonymousOrder: {
    // 匿名用户下单
    create(mealId, dishIds, shareToken, userName) {
      return callHttpFunction('order', 'createAnonymous', { mealId, dishIds, shareToken, userName })
    }
  }
}

/**
 * 通过 HTTP 调用云函数
 * @param {string} functionName - 云函数名称
 * @param {string} action - 操作类型
 * @param {Object} data - 请求数据
 * @returns {Promise} 请求结果
 */
function callHttpFunction(functionName, action, data = {}) {
  return new Promise((resolve, reject) => {
    const url = `${BASE_URL}/${functionName}`
    
    // 获取本地存储的用户信息
    const userInfo = wx.getStorageSync('userInfo') || {}
    const openid = wx.getStorageSync('openid') || ''
    
    const requestBody = {
      action,
      data: {
        ...data,
        _userInfo: userInfo,
        _openid: openid
      }
    }
    console.log(`调用云函数 ${functionName}，请求体:`, requestBody)

    wx.request({
      url: url,
      method: 'POST',
      header: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'Authorization': `Bearer ${API_KEY}`
      },
      data: requestBody,
      success: (res) => {
        console.log(`调用云函数 ${functionName} 响应:`, res)
        if (res.statusCode === 200) {
          const result = res.data
          if (result.success) {
            resolve(result)
          } else {
            wx.showToast({
              title: result.message || '操作失败',
              icon: 'none'
            })
            reject(new Error(result.message || '操作失败'))
          }
        } else {
          console.error(`调用云函数 ${functionName} 失败:`, res)
          console.error('错误详情:', res.data)
          wx.showToast({
            title: `请求失败: ${res.statusCode}`,
            icon: 'none'
          })
          reject(new Error(`HTTP ${res.statusCode}`))
        }
      },
      fail: (err) => {
        console.error(`调用云函数 ${functionName} 失败:`, err)
        wx.showToast({
          title: '网络错误，请稍后重试',
          icon: 'none'
        })
        reject(err)
      }
    })
  })
}

/**
 * 通过 wx.cloud.callFunction 调用本地云函数（开发环境使用）
 * @param {string} functionName - 云函数名称
 * @param {string} action - 操作类型
 * @param {Object} data - 请求数据
 * @returns {Promise} 请求结果
 */
function callLocalFunction(functionName, action, data = {}) {
  return new Promise((resolve, reject) => {
    // 获取本地存储的用户信息
    const userInfo = wx.getStorageSync('userInfo') || {}
    const openid = wx.getStorageSync('openid') || ''

    const requestData = {
      action,
      data: {
        ...data,
        _userInfo: userInfo,
        _openid: openid
      }
    }
    console.log(`调用本地云函数 ${functionName}，请求体:`, requestData)

    wx.cloud.callFunction({
      name: functionName,
      data: requestData,
      success: (res) => {
        console.log(`调用本地云函数 ${functionName} 响应:`, res)
        const result = res.result
        if (result.success) {
          resolve(result)
        } else {
          wx.showToast({
            title: result.message || '操作失败',
            icon: 'none'
          })
          reject(new Error(result.message || '操作失败'))
        }
      },
      fail: (err) => {
        console.error(`调用本地云函数 ${functionName} 失败:`, err)
        wx.showToast({
          title: '调用失败，请稍后重试',
          icon: 'none'
        })
        reject(err)
      }
    })
  })
}

module.exports = {
  API
}
