/**
 * Jest 测试环境设置
 * 配置完整的微信小程序模拟环境
 */

const path = require('path');

// 加载 wx 模拟
const wx = require('./__mocks__/wx');
global.wx = wx;

// 加载 Page 工厂
require('./__mocks__/page-factory');

// 模拟 Component 构造器
global.Component = jest.fn((options) => options);

// 模拟 App 构造器
global.App = jest.fn((options) => options);

// 模拟 getApp
global.getApp = jest.fn(() => ({
  globalData: {
    currentMeal: null,
    currentMenu: null,
    editingMeal: null,
    viewMode: false,
    currentKitchen: null
  }
}));

// 模拟 Behavior
global.Behavior = jest.fn((options) => options);

// 清理模拟数据
beforeEach(() => {
  jest.clearAllMocks();
  wx.clearStorageSync();
});

// 导出工具函数
global.loadPage = (pagePath) => {
  // 清除之前的 Page 调用记录
  global.Page.mockClear();
  
  // 加载页面模块
  jest.isolateModules(() => {
    require(pagePath);
  });
  
  // 返回创建的 Page 实例
  return global.Page.mock.results[0]?.value;
};
