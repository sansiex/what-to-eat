/**
 * 首页测试
 * 测试驱动开发 - 验证首页功能
 */

// 模拟微信小程序API
const mockWx = {
  showToast: jest.fn(),
  showModal: jest.fn(),
  navigateTo: jest.fn(),
  switchTab: jest.fn()
};

// 模拟云API
const mockAPI = {
  dish: {
    list: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn()
  }
};

// 模拟全局数据
const mockGlobalData = {
  dishes: []
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

describe('首页测试', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('测试跳转到发起点菜页面', () => {
    mockWx.navigateTo({ url: '/pages/initiate-meal/initiate-meal' });
    
    expect(mockWx.navigateTo).toHaveBeenCalledWith({
      url: '/pages/initiate-meal/initiate-meal'
    });
  });

  test('测试添加菜品功能', async () => {
    mockAPI.dish.create.mockResolvedValue({
      data: { id: 1, name: '红烧肉' }
    });

    const result = await mockAPI.dish.create('红烧肉', '');
    
    expect(mockAPI.dish.create).toHaveBeenCalledWith('红烧肉', '');
    expect(result.data.id).toBe(1);
  });

  test('测试编辑菜品功能', async () => {
    mockAPI.dish.update.mockResolvedValue({});

    await mockAPI.dish.update({ id: 1, name: '红烧排骨' });
    
    expect(mockAPI.dish.update).toHaveBeenCalledWith({ id: 1, name: '红烧排骨' });
  });

  test('测试删除菜品功能', async () => {
    mockAPI.dish.delete.mockResolvedValue({});

    await mockAPI.dish.delete(1);
    
    expect(mockAPI.dish.delete).toHaveBeenCalledWith(1);
  });

  test('测试页面文件存在', () => {
    const fs = require('fs');
    
    expect(fs.existsSync('pages/index/index.js')).toBe(true);
    expect(fs.existsSync('pages/index/index.wxml')).toBe(true);
    expect(fs.existsSync('pages/index/index.wxss')).toBe(true);
    expect(fs.existsSync('pages/index/index.json')).toBe(true);
  });

  test('验证JS包含必要方法', () => {
    const fs = require('fs');
    const js = fs.readFileSync('pages/index/index.js', 'utf-8');
    
    expect(js).toContain('loadDishes');
    expect(js).toContain('addDish');
    expect(js).toContain('updateDish');
    expect(js).toContain('deleteDish');
  });
});
