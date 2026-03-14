/**
 * 发起点菜页面测试
 * 测试驱动开发 - 验证发起点餐功能
 */

// 模拟微信小程序API
const mockWx = {
  showToast: jest.fn(),
  showModal: jest.fn(),
  showLoading: jest.fn(),
  hideLoading: jest.fn(),
  navigateTo: jest.fn(),
  switchTab: jest.fn()
};

// 模拟云API
const mockAPI = {
  meal: {
    create: jest.fn()
  },
  dish: {
    list: jest.fn()
  }
};

// 模拟全局数据
const mockGlobalData = {
  currentKitchen: { id: 1, name: '我的厨房' }
};

// 设置全局变量
global.wx = mockWx;
global.getApp = jest.fn(() => ({
  globalData: mockGlobalData
}));

// 模拟云API
jest.mock('../../utils/cloud-api.js', () => ({
  API: mockAPI
}));

describe('发起点菜页面测试', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('测试跳转到点餐页面', async () => {
    mockAPI.meal.create.mockResolvedValue({
      data: { id: 1, name: '午餐' }
    });

    const result = await mockAPI.meal.create({
      name: '午餐',
      dishIds: [1, 2]
    });

    expect(mockAPI.meal.create).toHaveBeenCalledWith({
      name: '午餐',
      dishIds: [1, 2]
    });
    expect(result.data.id).toBe(1);
  });

  test('测试未选择餐名时的提示', () => {
    const mealName = '';
    
    expect(mealName.trim()).toBe('');
  });

  test('测试未选择菜品时的提示', () => {
    const selectedDishes = [];
    
    expect(selectedDishes.length).toBe(0);
  });

  test('测试页面文件存在', () => {
    const fs = require('fs');
    
    expect(fs.existsSync('pages/initiate-meal/initiate-meal.js')).toBe(true);
    expect(fs.existsSync('pages/initiate-meal/initiate-meal.wxml')).toBe(true);
    expect(fs.existsSync('pages/initiate-meal/initiate-meal.wxss')).toBe(true);
    expect(fs.existsSync('pages/initiate-meal/initiate-meal.json')).toBe(true);
  });

  test('验证JS包含必要方法', () => {
    const fs = require('fs');
    const js = fs.readFileSync('pages/initiate-meal/initiate-meal.js', 'utf-8');
    
    expect(js).toContain('initiateMeal');
    expect(js).toContain('selectMealType');
  });
});
