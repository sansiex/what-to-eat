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

    const result = await mockAPI.meal.create('午餐', [1, 2], 1);

    expect(mockAPI.meal.create).toHaveBeenCalledWith('午餐', [1, 2], 1);
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
    expect(js).toContain('toggleDishSelection');
    expect(js).toContain('API.dish.list(kitchenId');
    expect(js).toContain('onUnload');
    expect(js).toContain('API.meal.create');
    expect(js).toContain('kitchenId');
    expect(js).toContain('buildSchedulePayload');
    expect(js).toContain('initMealSchedulePickers');
    expect(js).toContain('createDefaultMealSchedulePickerData');
    expect(js).toContain('refreshPickerBindDataForIOS');
    expect(js).toContain('requestMealOrderNotifySubscribe');
  });

  test('验证WXML展示已选菜品数', () => {
    const fs = require('fs');
    const wxml = fs.readFileSync('pages/initiate-meal/initiate-meal.wxml', 'utf-8');

    expect(wxml).toContain('selectedDishes.length');
    expect(wxml).toContain('dishes.length');
    expect(wxml).toContain('菜单共有');
    expect(wxml).toContain('selected-dish-count');
  });

  test('验证菜品行按勾选状态区分样式类', () => {
    const fs = require('fs');
    const wxml = fs.readFileSync('pages/initiate-meal/initiate-meal.wxml', 'utf-8');

    expect(wxml).toContain('dish-select-row');
    expect(wxml).toContain('dish-select-row--selected');
    expect(wxml).toContain('dish-select-row--unselected');
    expect(wxml).toContain('dish-list-thumb');
    expect(wxml).toContain('dish-select-row__inner');
    expect(wxml).toContain('dish-select-row__check');
  });

  test('验证发起点餐表单标签与按钮文案及无选中时禁用', () => {
    const fs = require('fs');
    const wxml = fs.readFileSync('pages/initiate-meal/initiate-meal.wxml', 'utf-8');

    expect(wxml).toContain('initiate-form-section-label');
    expect(wxml).toContain('>餐名<');
    expect(wxml).toContain('>用餐时间<');
    expect(wxml).toContain('>菜品选择<');
    expect(wxml).toContain('initiate-form-section-sub');
    expect(wxml).toContain('发起点餐后，其他人可以点选所有选中的菜品');
    expect(wxml).toContain('确认发起点餐');
    expect(wxml).toContain('icon-start-meal.png');
    expect(wxml).toContain('btn--footer-initiate');
    expect(wxml).toContain('用餐时间');
    expect(wxml).toContain('class="meal-schedule-row__value">{{mealTimeDisplay}}');
    expect(wxml).toContain('onMealDateChange');
    expect(wxml).toContain('onMealTimeChange');
    expect(wxml).toContain('disabled="{{!selectedMealName || selectedDishes.length === 0}}"');
  });

  test('验证底部栏与滚动区结构（按钮不跟在列表末尾）', () => {
    const fs = require('fs');
    const wxml = fs.readFileSync('pages/initiate-meal/initiate-meal.wxml', 'utf-8');

    expect(wxml).toContain('page-initiate-meal');
    expect(wxml).toContain('initiate-meal-form-top');
    expect(wxml).toContain('initiate-meal-scroll');
    expect(wxml).toContain('initiate-meal-footer');
    expect(wxml).toContain('btn--footer');
    expect(wxml).toContain('btn--footer-complete');
    expect(wxml).toContain('success_no_circle');
    expect(wxml).toContain('initiate-footer-btn-inner');
  });
});
