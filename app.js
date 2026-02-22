// app.js
App({
  onLaunch() {
    // 初始化本地存储
    this.initStorage()
  },
  
  initStorage() {
    // 检查是否已有菜品数据
    const dishes = wx.getStorageSync('dishes')
    if (!dishes) {
      // 初始化默认菜品
      const defaultDishes = [
        { id: '1', name: '番茄炒蛋' },
        { id: '2', name: '宫保鸡丁' },
        { id: '3', name: '红烧肉' },
        { id: '4', name: '鱼香肉丝' },
        { id: '5', name: '糖醋排骨' }
      ]
      wx.setStorageSync('dishes', defaultDishes)
    }
  },
  
  globalData: {
    currentMeal: null
  }
})