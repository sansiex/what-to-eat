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
    list(keyword = '') {
      return callHttpFunction('dish', 'list', { keyword })
    },

    // 创建菜品
    create(name, description = '') {
      return callHttpFunction('dish', 'create', { name, description })
    },

    // 更新菜品
    update(id, name, description = '') {
      return callHttpFunction('dish', 'update', { id, name, description })
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
    // 获取点餐列表
    list(status = null) {
      const data = status ? { status } : {}
      return callHttpFunction('meal', 'list', data)
    },

    // 创建点餐
    create(name, dishIds) {
      return callHttpFunction('meal', 'create', { name, dishIds })
    },

    // 更新点餐
    update(id, name, dishIds) {
      return callHttpFunction('meal', 'update', { id, name, dishIds })
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
    }
  },

  // 订单管理
  order: {
    // 创建订单（下单）
    create(mealId, dishIds) {
      return callHttpFunction('order', 'create', { mealId, dishIds })
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
    }
  },

  // 用户管理
  user: {
    // 登录
    login(code, userInfo = null) {
      return callHttpFunction('user', 'login', { code, userInfo })
    },

    // 获取用户信息
    get() {
      return callHttpFunction('user', 'get')
    },

    // 更新用户信息
    update(nickname, avatarUrl) {
      return callHttpFunction('user', 'update', { nickname, avatarUrl })
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
    const requestBody = {
      action,
      data
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

module.exports = {
  API
}
