/**
 * 微信小程序 API 完整模拟
 * 提供所有 wx 对象的模拟实现
 */

const mockStorage = new Map();

const wx = {
  // 界面交互
  showToast: jest.fn((options) => {
    console.log('[Mock wx.showToast]', options);
    if (options.success) options.success();
  }),
  showModal: jest.fn((options) => {
    console.log('[Mock wx.showModal]', options);
    if (options.success) options.success({ confirm: true });
  }),
  showLoading: jest.fn((options) => {
    console.log('[Mock wx.showLoading]', options);
  }),
  hideLoading: jest.fn(() => {}),
  showActionSheet: jest.fn((options) => {
    console.log('[Mock wx.showActionSheet]', options);
    if (options.success) options.success({ tapIndex: 0 });
  }),

  // 导航
  navigateTo: jest.fn((options) => {
    console.log('[Mock wx.navigateTo]', options.url);
    if (options.success) options.success();
  }),
  navigateBack: jest.fn((options) => {
    console.log('[Mock wx.navigateBack]');
    if (options?.success) options.success();
  }),
  redirectTo: jest.fn((options) => {
    console.log('[Mock wx.redirectTo]', options.url);
    if (options.success) options.success();
  }),
  switchTab: jest.fn((options) => {
    console.log('[Mock wx.switchTab]', options.url);
    if (options.success) options.success();
  }),
  reLaunch: jest.fn((options) => {
    console.log('[Mock wx.reLaunch]', options.url);
    if (options.success) options.success();
  }),

  // 数据缓存
  setStorageSync: jest.fn((key, data) => {
    mockStorage.set(key, data);
  }),
  getStorageSync: jest.fn((key) => {
    return mockStorage.get(key);
  }),
  removeStorageSync: jest.fn((key) => {
    mockStorage.delete(key);
  }),
  clearStorageSync: jest.fn(() => {
    mockStorage.clear();
  }),

  // 网络请求
  request: jest.fn((options) => {
    console.log('[Mock wx.request]', options.url);
    if (options.success) {
      options.success({
        data: {},
        statusCode: 200,
        header: {}
      });
    }
  }),

  // 用户信息
  getUserProfile: jest.fn((options) => {
    if (options.success) {
      options.success({
        userInfo: {
          nickName: '测试用户',
          avatarUrl: 'https://example.com/avatar.png'
        }
      });
    }
  }),
  login: jest.fn((options) => {
    if (options.success) {
      options.success({
        code: 'mock_code_12345'
      });
    }
  }),

  // 剪贴板
  setClipboardData: jest.fn((options) => {
    console.log('[Mock wx.setClipboardData]', options.data);
    if (options.success) options.success();
  }),

  // 分享
  shareAppMessage: jest.fn((options) => {
    console.log('[Mock wx.shareAppMessage]', options);
  }),

  // 系统信息
  getSystemInfoSync: jest.fn(() => ({
    windowWidth: 375,
    windowHeight: 667,
    pixelRatio: 2
  })),

  // 下一个 tick
  nextTick: jest.fn((callback) => {
    setTimeout(callback, 0);
  })
};

module.exports = wx;
