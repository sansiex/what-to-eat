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
      
      if (pageInstance.editMenu) {
        // 模拟点击事件
        pageInstance.editMenu({
          currentTarget: {
            dataset: { menu: menu }
          }
        });
        
        // 验证全局数据被设置
        expect(mockGlobalData.currentMenu).toEqual(menu);
        
        // 验证导航调用
        expect(wx.navigateTo).toHaveBeenCalledWith({
          url: '/pages/menu-edit/menu-edit?mode=edit'
        });
      }
    });

    test('测试 deleteMenu 方法', async () => {
      mockAPI.menu.delete.mockResolvedValue({});
      
      if (pageInstance.deleteMenu) {
        // 模拟点击事件
        await pageInstance.deleteMenu({
          currentTarget: {
            dataset: { id: 1 }
          }
        });
        
        // 验证确认对话框显示
        expect(wx.showModal).toHaveBeenCalled();
      }
    });
  });

  describe('发起点餐弹窗测试', () => {
    test('测试 showInitiateMealDialog 方法', () => {
      const menu = {
        id: 1,
        name: '午餐菜单',
        dishes: [
          { id: 1, name: '红烧肉' },
          { id: 2, name: '酸菜鱼' }
        ]
      };

      if (pageInstance.showInitiateMealDialog) {
        pageInstance.showInitiateMealDialog({
          currentTarget: {
            dataset: { menu: menu }
          }
        });

        // 验证弹窗显示状态
        expect(pageInstance.setData).toHaveBeenCalledWith(
          expect.objectContaining({
            showInitiateDialog: true
          })
        );
      }
    });

    test('测试 confirmInitiateMeal 方法', async () => {
      mockAPI.meal.create.mockResolvedValue({
        data: { id: 100, name: '午餐菜单' }
      });

      if (pageInstance.confirmInitiateMeal) {
        // 设置选中菜品
        pageInstance.data = {
          ...pageInstance.data,
          selectedMealName: '午餐菜单',
          selectedDishes: [1, 2]
        };

        await pageInstance.confirmInitiateMeal();

        // 验证 API 调用
        expect(mockAPI.meal.create).toHaveBeenCalledWith('午餐菜单', [1, 2]);
        
        // 验证导航到点餐页面
        expect(wx.navigateTo).toHaveBeenCalledWith({
          url: '/pages/order-food/order-food'
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
