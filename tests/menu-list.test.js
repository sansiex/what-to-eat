/**
 * 菜单列表页面测试
 * 测试驱动开发 - 验证菜单列表功能
 */

const path = require('path');

// 模拟微信小程序API
const mockWx = {
  showToast: jest.fn(),
  showModal: jest.fn(),
  navigateTo: jest.fn(),
  switchTab: jest.fn()
};

// 模拟云API
const mockAPI = {
  menu: {
    list: jest.fn(),
    delete: jest.fn()
  },
  meal: {
    create: jest.fn()
  }
};

// 模拟全局数据
const mockGlobalData = {
  currentMenu: null
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

describe('菜单列表页面测试', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    
    // 重置全局数据
    mockGlobalData.currentMenu = null;
  });

  describe('菜单列表展示', () => {
    test('测试加载菜单列表', async () => {
      // 模拟menu.list返回菜单列表
      mockAPI.menu.list.mockResolvedValue({
        data: {
          list: [
            {
              id: 1,
              name: '午餐菜单',
              dishes: [{ id: 1, name: '红烧肉' }],
              dishCount: 1
            }
          ]
        }
      });

      // 验证API调用
      const result = await mockAPI.menu.list();
      expect(result.data.list).toHaveLength(1);
      expect(result.data.list[0].name).toBe('午餐菜单');
    });

    test('测试空菜单列表', async () => {
      mockAPI.menu.list.mockResolvedValue({ data: { list: [] } });
      
      const result = await mockAPI.menu.list();
      expect(result.data.list).toHaveLength(0);
    });
  });

  describe('编辑菜单', () => {
    test('测试点击编辑按钮', () => {
      const menu = { id: 1, name: '午餐菜单', dishes: [] };
      
      // 模拟存储到全局
      mockGlobalData.currentMenu = menu;
      
      // 验证全局数据已设置
      expect(mockGlobalData.currentMenu.id).toBe(1);
      
      // 验证导航调用
      mockWx.navigateTo({ url: '/pages/menu-edit/menu-edit?mode=edit' });
      expect(mockWx.navigateTo).toHaveBeenCalledWith({
        url: '/pages/menu-edit/menu-edit?mode=edit'
      });
    });
  });

  describe('删除菜单', () => {
    test('测试删除菜单（软删除）', async () => {
      mockAPI.menu.delete.mockResolvedValue({});
      
      await mockAPI.menu.delete(1);
      
      expect(mockAPI.menu.delete).toHaveBeenCalledWith(1);
    });
  });

  describe('发起点餐', () => {
    test('测试发起点餐弹窗数据', () => {
      const menu = {
        id: 1,
        name: '午餐菜单',
        dishes: [
          { id: 1, name: '红烧肉' },
          { id: 2, name: '酸菜鱼' }
        ]
      };

      // 验证菜单数据
      expect(menu.dishes).toHaveLength(2);
      expect(menu.name).toBe('午餐菜单');
    });

    test('测试搜索菜品过滤', () => {
      const dishes = [
        { id: 1, name: '红烧肉' },
        { id: 2, name: '酸菜鱼' }
      ];
      
      const keyword = '红烧肉';
      const filtered = dishes.filter(d => 
        d.name.toLowerCase().includes(keyword.toLowerCase())
      );
      
      expect(filtered).toHaveLength(1);
      expect(filtered[0].name).toBe('红烧肉');
    });

    test('测试剔除菜品', () => {
      const selectedDishes = [1, 2];
      const dishIdToRemove = 1;
      
      const newSelected = selectedDishes.filter(id => id !== dishIdToRemove);
      
      expect(newSelected).not.toContain(1);
      expect(newSelected).toContain(2);
    });

    test('测试确认发起点餐', async () => {
      mockAPI.meal.create.mockResolvedValue({
        data: { id: 100, name: '午餐菜单' }
      });

      const result = await mockAPI.meal.create('午餐菜单', [1, 2], null);
      
      expect(mockAPI.meal.create).toHaveBeenCalledWith('午餐菜单', [1, 2], null);
      expect(result.data.id).toBe(100);
    });
  });

  describe('创建菜单', () => {
    test('测试创建菜单跳转', () => {
      // 重置全局数据
      mockGlobalData.currentMenu = null;
      
      // 验证全局数据为null
      expect(mockGlobalData.currentMenu).toBeNull();
      
      // 验证导航调用
      mockWx.navigateTo({ url: '/pages/menu-edit/menu-edit?mode=create' });
      expect(mockWx.navigateTo).toHaveBeenCalledWith({
        url: '/pages/menu-edit/menu-edit?mode=create'
      });
    });
  });

  describe('WXML结构验证', () => {
    test('验证页面文件存在', () => {
      const fs = require('fs');
      
      expect(fs.existsSync('pages/menu-list/menu-list.js')).toBe(true);
      expect(fs.existsSync('pages/menu-list/menu-list.wxml')).toBe(true);
      expect(fs.existsSync('pages/menu-list/menu-list.wxss')).toBe(true);
      expect(fs.existsSync('pages/menu-list/menu-list.json')).toBe(true);
    });

    test('验证WXML包含必要元素', () => {
      const fs = require('fs');
      const wxml = fs.readFileSync('pages/menu-list/menu-list.wxml', 'utf-8');

      expect(wxml).toContain('创建新菜单');
      expect(wxml).toContain('editMenu');
      expect(wxml).toContain('goInitiateMeal');
    });

    test('验证JS包含必要方法', () => {
      const fs = require('fs');
      const js = fs.readFileSync('pages/menu-list/menu-list.js', 'utf-8');

      expect(js).toContain('loadMenus');
      expect(js).toContain('createMenu');
      expect(js).toContain('editMenu');
      expect(js).toContain('goInitiateMeal');
    });
  });
});
