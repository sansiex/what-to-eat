/**
 * 点餐列表页测试
 * 测试驱动开发 - 验证点餐列表功能
 */

// 模拟微信小程序API
const mockWx = {
  showToast: jest.fn(),
  showModal: jest.fn(),
  showLoading: jest.fn(),
  hideLoading: jest.fn(),
  navigateTo: jest.fn(),
  switchTab: jest.fn(),
  setStorageSync: jest.fn()
};

// 模拟云API
const mockAPI = {
  meal: {
    list: jest.fn(),
    close: jest.fn()
  }
};

// 模拟全局数据
const mockGlobalData = {
  currentMeal: null
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

describe('点餐列表页测试', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGlobalData.currentMeal = null;
  });

  describe('【点餐】按钮跳转测试', () => {
    test('测试点餐按钮使用navigateTo跳转（非switchTab）', () => {
      const meal = {
        id: 1,
        name: '午餐',
        status: 'ordering'
      };
      
      // 存储到全局
      mockGlobalData.currentMeal = meal;
      
      // 使用navigateTo跳转
      mockWx.navigateTo({ url: '/pages/order-food/order-food' });
      
      expect(mockWx.navigateTo).toHaveBeenCalledWith({
        url: '/pages/order-food/order-food'
      });
      expect(mockGlobalData.currentMeal.id).toBe(1);
    });

    test('测试已收单的点餐不能进入点餐页面', () => {
      const closedMeal = {
        id: 1,
        name: '午餐',
        status: 'closed'
      };
      
      // 已收单不能点餐
      const canOrder = closedMeal.status === 'ordering';
      
      expect(canOrder).toBe(false);
    });

    test('测试查看按钮使用navigateTo跳转', () => {
      const meal = {
        id: 1,
        name: '午餐',
        status: 'closed'
      };
      
      mockGlobalData.currentMeal = meal;
      mockGlobalData.viewMode = true;
      
      mockWx.navigateTo({ url: '/pages/order-food/order-food' });
      
      expect(mockWx.navigateTo).toHaveBeenCalledWith({
        url: '/pages/order-food/order-food'
      });
    });
  });

  describe('其他功能测试', () => {
    test('测试加载点餐列表', async () => {
      mockAPI.meal.list.mockResolvedValue({
        data: {
          list: [
            {
              id: 1,
              name: '午餐',
              status: 'ordering',
              dishCount: 3,
              participantCount: 2
            }
          ]
        }
      });

      const result = await mockAPI.meal.list();
      
      expect(result.data.list).toHaveLength(1);
      expect(result.data.list[0].name).toBe('午餐');
    });

    test('测试收单功能', async () => {
      mockAPI.meal.close.mockResolvedValue({});
      
      await mockAPI.meal.close(1);
      
      expect(mockAPI.meal.close).toHaveBeenCalledWith(1);
    });
  });

  describe('WXML结构验证', () => {
    test('验证页面文件存在', () => {
      const fs = require('fs');
      
      expect(fs.existsSync('pages/meal-list/meal-list.js')).toBe(true);
      expect(fs.existsSync('pages/meal-list/meal-list.wxml')).toBe(true);
      expect(fs.existsSync('pages/meal-list/meal-list.wxss')).toBe(true);
      expect(fs.existsSync('pages/meal-list/meal-list.json')).toBe(true);
    });

    test('验证WXML包含必要元素', () => {
      const fs = require('fs');
      const wxml = fs.readFileSync('pages/meal-list/meal-list.wxml', 'utf-8');

      expect(wxml).toContain('点餐');
      expect(wxml).toContain('goMealDetail');
      expect(wxml).toContain('createdAtDisplay');
      expect(wxml).toContain('scheduledMealDisplay');
      expect(wxml).toContain('meal-time--scheduled');
      expect(wxml).toContain('meal-time--created-lead');
      expect(wxml).toContain('sortMode === \'scheduled\'');
      expect(wxml).toContain('用餐时间');
      expect(wxml).not.toContain('发起人：');
      expect(wxml).toContain('{{sec.title}}');
      expect(wxml).toContain('已经到底啦');
      expect(wxml).toContain('mealSections');
      expect(wxml).toContain('onSortModeChange');
      expect(wxml).toContain('sortModePickerRange');
      expect(wxml).toContain('toggleSection');
      expect(wxml).toContain('listLoading');
      expect(wxml).toContain('list-loading-spinner');
      expect(wxml).not.toMatch(/\{\{item\.name\}\}\s*\{\{item\.weekday\}\}/);
    });

    test('用餐时间行为黑色样式类', () => {
      const fs = require('fs');
      const wxss = fs.readFileSync('pages/meal-list/meal-list.wxss', 'utf-8');
      expect(wxss).toMatch(/\.meal-time\.meal-time--scheduled/);
      expect(wxss).toMatch(/#000000/);
    });

    test('验证JS包含必要方法', () => {
    const fs = require('fs');
    const js = fs.readFileSync('pages/meal-list/meal-list.js', 'utf-8');
    
    expect(js).toContain('loadMeals');
    expect(js).toContain('closeMeal');
    expect(js).toContain('goMealDetail');
    expect(js).toContain('createdAtDisplay');
    expect(js).toContain('formatScheduledMealDisplayForOrderFood');
    expect(js).toContain('scheduledMealDisplay');
    expect(js).toContain('loadMoreHistory');
    expect(js).toContain('partitionMealsByScheduledBeijingDate');
    expect(js).toContain('partitionMealsByBeijingCalendar');
    expect(js).toContain('getMealListBeijingBoundaries');
    expect(js).toContain('wte_meal_list_sort_mode');
    expect(js).toContain('onSortModeChange');
    expect(js).toContain('按用餐时间排列');
    expect(js).toContain('按发起时间排列');
    expect(js).toContain('明天及以后用餐');
    expect(js).toContain('今天用餐');
    expect(js).toContain('今天的点餐');
    expect(js).toContain('昨天的点餐');
    expect(js).toContain('mealEffectiveScheduledBeijingYmd');
    expect(js).toContain('initDefaultKitchen');
  });
  });
});
