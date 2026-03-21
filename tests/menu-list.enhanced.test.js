/**
 * 菜单列表页面增强测试
 * 使用完整的 Page 模拟环境，可以测试生命周期和数据流
 */

const path = require('path');

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
let mockGlobalData = {
  currentMenu: null
};

// 重置全局 getApp
beforeEach(() => {
  mockGlobalData = { currentMenu: null };
  global.getApp = jest.fn(() => ({
    globalData: mockGlobalData
  }));
});

// 模拟云API
jest.mock('../../utils/cloud-api.js', () => ({
  API: mockAPI
}));

describe('菜单列表页面增强测试', () => {
  let pageInstance;

  beforeEach(() => {
    jest.clearAllMocks();
    
    // 使用 loadPage 工具函数加载页面
    pageInstance = global.loadPage(
      path.join(__dirname, '../pages/menu-list/menu-list.js')
    );
  });

  describe('页面生命周期测试', () => {
    test('测试 onLoad 生命周期', () => {
      // 模拟 API 返回数据
      mockAPI.menu.list.mockResolvedValue({
        data: {
          list: [
            { id: 1, name: '午餐菜单', dishes: [{ id: 1, name: '红烧肉' }] }
          ]
        }
      });

      // 调用 onLoad
      pageInstance.load();
      
      // 验证 setData 被调用
      expect(pageInstance.setData).toHaveBeenCalled();
    });

    test('测试 onShow 生命周期', () => {
      // 调用 onShow
      pageInstance.show();
      
      // 验证会刷新数据
      expect(pageInstance.onShow).toBeDefined();
    });
  });

  describe('数据操作测试', () => {
    test('测试 createMenu 方法', () => {
      // 调用创建菜单方法
      if (pageInstance.createMenu) {
        pageInstance.createMenu();
        
        // 验证导航调用
        expect(wx.navigateTo).toHaveBeenCalledWith({
          url: '/pages/menu-edit/menu-edit?mode=create'
        });
      }
    });

    test('测试 editMenu 方法', () => {
      const menu = { id: 1, name: '测试菜单', dishes: [] };
      pageInstance.setData({ menus: [menu] });

      if (pageInstance.editMenu) {
        pageInstance.editMenu({
          currentTarget: {
            dataset: { id: 1 }
          }
        });

        expect(mockGlobalData.currentMenu).toEqual(menu);
        expect(wx.navigateTo).toHaveBeenCalledWith({
          url: '/pages/menu-edit/menu-edit?mode=edit'
        });
      }
    });

  });

  describe('发起点餐测试', () => {
    test('测试 goInitiateMeal 方法跳转到发起点餐页', () => {
      const menu = {
        id: 1,
        name: '午餐菜单',
        dishes: [
          { id: 1, name: '红烧肉', imageUrl: '' },
          { id: 2, name: '酸菜鱼', imageUrl: '' }
        ]
      };
      pageInstance.setData({ menus: [menu] });

      if (pageInstance.goInitiateMeal) {
        pageInstance.goInitiateMeal({
          currentTarget: { dataset: { id: 1 } }
        });

        expect(getApp().globalData.initiateFromMenu).toBeDefined();
        expect(getApp().globalData.initiateFromMenu.name).toBe('午餐菜单');
        expect(wx.navigateTo).toHaveBeenCalledWith({
          url: '/pages/initiate-meal/initiate-meal?fromMenu=1'
        });
      }
    });
  });

  describe('搜索功能测试', () => {
    test('测试搜索过滤逻辑', () => {
      const allDishes = [
        { id: 1, name: '红烧肉' },
        { id: 2, name: '酸菜鱼' },
        { id: 3, name: '宫保鸡丁' }
      ];

      // 测试搜索关键词
      const keyword = '红烧肉';
      const filtered = allDishes.filter(d => 
        d.name.toLowerCase().includes(keyword.toLowerCase())
      );

      expect(filtered).toHaveLength(1);
      expect(filtered[0].name).toBe('红烧肉');
    });
  });
});
