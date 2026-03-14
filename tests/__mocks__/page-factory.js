/**
 * 页面工厂 - 模拟微信小程序 Page 构造器
 * 用于在测试中创建可测试的页面对象
 */

class PageMock {
  constructor(options) {
    // 初始化数据
    this.data = options.data || {};
    
    // 保存所有方法
    this.methods = {};
    Object.keys(options).forEach(key => {
      if (typeof options[key] === 'function') {
        this.methods[key] = options[key].bind(this);
        this[key] = this.methods[key];
      }
    });

    // 模拟 setData
    this.setData = jest.fn((newData, callback) => {
      this.data = { ...this.data, ...newData };
      if (callback) callback();
    });

    // 存储生命周期函数
    this.onLoad = options.onLoad ? options.onLoad.bind(this) : null;
    this.onShow = options.onShow ? options.onShow.bind(this) : null;
    this.onReady = options.onReady ? options.onReady.bind(this) : null;
    this.onHide = options.onHide ? options.onHide.bind(this) : null;
    this.onUnload = options.onUnload ? options.onUnload.bind(this) : null;
    this.onPullDownRefresh = options.onPullDownRefresh ? options.onPullDownRefresh.bind(this) : null;
    this.onReachBottom = options.onReachBottom ? options.onReachBottom.bind(this) : null;

    // 事件处理函数
    this.onShareAppMessage = options.onShareAppMessage ? options.onShareAppMessage.bind(this) : null;
  }

  // 模拟触发事件
  triggerEvent(eventName, eventObj = {}) {
    if (this.methods[eventName]) {
      return this.methods[eventName](eventObj);
    }
  }

  // 模拟页面加载
  load(options = {}) {
    if (this.onLoad) {
      this.onLoad(options);
    }
  }

  // 模拟页面显示
  show() {
    if (this.onShow) {
      this.onShow();
    }
  }

  // 模拟页面就绪
  ready() {
    if (this.onReady) {
      this.onReady();
    }
  }

  // 模拟页面隐藏
  hide() {
    if (this.onHide) {
      this.onHide();
    }
  }

  // 模拟页面卸载
  unload() {
    if (this.onUnload) {
      this.onUnload();
    }
  }
}

// 全局 Page 构造器模拟
global.Page = jest.fn((options) => {
  return new PageMock(options);
});

module.exports = { PageMock };
