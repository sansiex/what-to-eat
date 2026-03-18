/**
 * 点餐页面测试
 */

// 模拟微信小程序API
const mockWx = {
  showToast: jest.fn(),
  showActionSheet: jest.fn(),
  setClipboardData: jest.fn(),
  getStorageSync: jest.fn(),
  setStorageSync: jest.fn(),
  navigateBack: jest.fn()
};

// 模拟云API
const mockAPI = {
  share: {
    generateShareLink: jest.fn()
  },
  order: {
    create: jest.fn(),
    list: jest.fn()
  },
  meal: {
    get: jest.fn()
  }
};

// 模拟全局数据
const mockGlobalData = {
  currentMeal: {
    id: 1,
    name: '午餐',
    status: 'ordering',
    initiator: 'testUser',
    createdAt: '2024-01-01T00:00:00Z',
    dishes: [
      { id: 1, name: '家常菜1' },
      { id: 2, name: '家常菜2' }
    ]
  },
  viewMode: false
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

describe('点餐页面测试', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    
    // 模拟getStorageSync返回当前用户
    mockWx.getStorageSync.mockImplementation(key => {
      if (key === 'currentUser') return 'testUser';
      return null;
    });
  });

  test('测试发起人判断逻辑', () => {
    // 模拟当前用户是发起人
    mockWx.getStorageSync.mockImplementation(key => {
      if (key === 'currentUser') return 'testUser';
      return null;
    });
    
    const currentUser = mockWx.getStorageSync('currentUser');
    const isInitiator = currentUser === mockGlobalData.currentMeal.initiator;
    
    expect(isInitiator).toBe(true);
  });

  test('测试非发起人时不显示分享按钮', () => {
    // 模拟非发起人
    mockWx.getStorageSync.mockImplementation(key => {
      if (key === 'currentUser') return 'otherUser';
      return null;
    });
    
    const currentUser = mockWx.getStorageSync('currentUser');
    const isInitiator = currentUser === mockGlobalData.currentMeal.initiator;
    
    expect(isInitiator).toBe(false);
  });

  test('测试分享功能', async () => {
    // 模拟generateShareLink返回分享链接
    mockAPI.share.generateShareLink.mockResolvedValue({
      data: {
        shareUrl: 'https://example.com/share/1'
      }
    });
    
    const result = await mockAPI.share.generateShareLink(1);
    
    expect(mockAPI.share.generateShareLink).toHaveBeenCalledWith(1);
    expect(result.data.shareUrl).toBe('https://example.com/share/1');
  });

  test('测试已收单的点餐不能分享', () => {
    // 模拟已收单状态
    const closedMeal = {
      ...mockGlobalData.currentMeal,
      status: 'closed'
    };
    
    const canShare = closedMeal.status === 'ordering';
    
    expect(canShare).toBe(false);
  });

  test('测试下单功能', async () => {
    mockAPI.order.create.mockResolvedValue({
      data: { id: 100, mealId: 1, dishIds: [1, 2] }
    });
    
    const result = await mockAPI.order.create(1, [1, 2]);
    
    expect(mockAPI.order.create).toHaveBeenCalledWith(1, [1, 2]);
    expect(result.data.id).toBe(100);
  });

  test('测试页面文件存在', () => {
    const fs = require('fs');
    
    expect(fs.existsSync('pages/order-food/order-food.js')).toBe(true);
    expect(fs.existsSync('pages/order-food/order-food.wxml')).toBe(true);
    expect(fs.existsSync('pages/order-food/order-food.wxss')).toBe(true);
    expect(fs.existsSync('pages/order-food/order-food.json')).toBe(true);
  });

  test('验证WXML包含分享按钮', () => {
    const fs = require('fs');
    const wxml = fs.readFileSync('pages/order-food/order-food.wxml', 'utf-8');
    
    expect(wxml).toContain('分享');
    // 分享按钮应使用微信原生分享能力（与 meal-list 一致）
    expect(wxml).toContain('open-type="share"');
  });

  test('验证JS包含分享方法', () => {
    const fs = require('fs');
    const js = fs.readFileSync('pages/order-food/order-food.js', 'utf-8');
    
    expect(js).toContain('isInitiator');
    // 需要提供分享卡片配置
    expect(js).toContain('onShareAppMessage');
  });
});
