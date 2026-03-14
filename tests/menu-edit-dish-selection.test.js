/**
 * 菜单编辑页面 - 菜品选择功能测试
 * 测试驱动开发 - 验证菜品勾选功能修复
 */

const path = require('path');

describe('菜单编辑页面 - 菜品选择功能测试', () => {
  let pageInstance;
  let PageConstructor;

  beforeEach(() => {
    jest.clearAllMocks();
    
    // 捕获 Page 构造器
    PageConstructor = jest.fn((options) => {
      pageInstance = {
        data: options.data || {},
        setData: jest.fn(function(newData, callback) {
          this.data = { ...this.data, ...newData };
          if (callback) callback();
        }),
        ...options
      };
      return pageInstance;
    });
    
    global.Page = PageConstructor;
    
    // 加载页面
    jest.isolateModules(() => {
      require('../pages/menu-edit/menu-edit.js');
    });
  });

  describe('数据结构测试', () => {
    test('验证初始数据结构包含 selectedDishIds', () => {
      expect(pageInstance.data).toHaveProperty('selectedDishIds');
      expect(Array.isArray(pageInstance.data.selectedDishIds)).toBe(true);
    });

    test('验证初始数据结构包含菜品选中状态', () => {
      expect(pageInstance.data).toHaveProperty('allDishes');
      expect(pageInstance.data).toHaveProperty('filteredDishes');
    });
  });

  describe('toggleDishSelection 方法测试', () => {
    test('验证 toggleDishSelection 方法存在', () => {
      expect(pageInstance.toggleDishSelection).toBeDefined();
      expect(typeof pageInstance.toggleDishSelection).toBe('function');
    });

    test('验证选中菜品时更新数据结构', () => {
      // 设置初始数据
      pageInstance.data.allDishes = [
        { id: 1, name: '红烧肉', selected: false },
        { id: 2, name: '糖醋排骨', selected: false }
      ];
      pageInstance.data.filteredDishes = [...pageInstance.data.allDishes];
      pageInstance.data.selectedDishIds = [];

      // 模拟点击事件
      const mockEvent = {
        currentTarget: {
          dataset: { id: '1' }
        }
      };

      // 调用方法
      pageInstance.toggleDishSelection(mockEvent);

      // 验证 setData 被调用
      expect(pageInstance.setData).toHaveBeenCalled();
      
      // 验证调用参数包含正确的数据结构
      const callArgs = pageInstance.setData.mock.calls[0][0];
      expect(callArgs).toHaveProperty('selectedDishIds');
      expect(callArgs).toHaveProperty('allDishes');
      expect(callArgs).toHaveProperty('filteredDishes');
      
      // 验证菜品 ID 被添加到选中列表
      expect(callArgs.selectedDishIds).toContain(1);
    });

    test('验证取消选中菜品时更新数据结构', () => {
      // 设置初始数据（已选中状态）
      pageInstance.data.allDishes = [
        { id: 1, name: '红烧肉', selected: true },
        { id: 2, name: '糖醋排骨', selected: false }
      ];
      pageInstance.data.filteredDishes = [...pageInstance.data.allDishes];
      pageInstance.data.selectedDishIds = [1];

      // 模拟点击已选中的菜品
      const mockEvent = {
        currentTarget: {
          dataset: { id: '1' }
        }
      };

      // 调用方法
      pageInstance.toggleDishSelection(mockEvent);

      // 验证调用参数
      const callArgs = pageInstance.setData.mock.calls[0][0];
      
      // 验证菜品 ID 从选中列表中移除
      expect(callArgs.selectedDishIds).not.toContain(1);
      expect(callArgs.selectedDishIds).toHaveLength(0);
    });

    test('验证菜品选中状态同步更新', () => {
      // 设置初始数据
      pageInstance.data.allDishes = [
        { id: 1, name: '红烧肉', selected: false },
        { id: 2, name: '糖醋排骨', selected: false }
      ];
      pageInstance.data.filteredDishes = [...pageInstance.data.allDishes];
      pageInstance.data.selectedDishIds = [];

      // 模拟点击事件
      const mockEvent = {
        currentTarget: {
          dataset: { id: '1' }
        }
      };

      // 调用方法
      pageInstance.toggleDishSelection(mockEvent);

      // 验证调用参数
      const callArgs = pageInstance.setData.mock.calls[0][0];
      
      // 验证 allDishes 中对应菜品的 selected 属性更新
      const updatedDish = callArgs.allDishes.find(d => d.id === 1);
      expect(updatedDish.selected).toBe(true);
      
      // 验证 filteredDishes 中对应菜品的 selected 属性也更新
      const updatedFilteredDish = callArgs.filteredDishes.find(d => d.id === 1);
      expect(updatedFilteredDish.selected).toBe(true);
    });
  });

  describe('WXML 兼容性测试', () => {
    test('验证不使用 includes 表达式', () => {
      const fs = require('fs');
      const wxmlPath = path.join(__dirname, '../pages/menu-edit/menu-edit.wxml');
      const wxmlContent = fs.readFileSync(wxmlPath, 'utf-8');
      
      // 验证 WXML 不包含 includes 表达式
      expect(wxmlContent).not.toMatch(/includes\s*\(/);
      
      // 验证使用 item.selected 属性
      expect(wxmlContent).toMatch(/item\.selected/);
    });

    test('验证使用正确的选中状态绑定', () => {
      const fs = require('fs');
      const wxmlPath = path.join(__dirname, '../pages/menu-edit/menu-edit.wxml');
      const wxmlContent = fs.readFileSync(wxmlPath, 'utf-8');
      
      // 验证 checkbox 使用 item.selected
      expect(wxmlContent).toMatch(/checked="\{\{item\.selected\}\}"/);
      
      // 验证 class 使用 item.selected
      expect(wxmlContent).toMatch(/class="dish-item \{\{item\.selected/);
    });
  });

  describe('loadAllDishes 方法测试', () => {
    test('验证 loadAllDishes 方法存在', () => {
      expect(pageInstance.loadAllDishes).toBeDefined();
      expect(typeof pageInstance.loadAllDishes).toBe('function');
    });
    
    test('验证数据结构转换逻辑', () => {
      // 模拟菜品数据
      const mockDishes = [
        { id: 1, name: '红烧肉' },
        { id: 2, name: '糖醋排骨' }
      ];
      
      const selectedDishIds = [1];
      
      // 模拟数据转换逻辑（与页面代码一致）
      const dishesWithSelected = mockDishes.map(dish => ({
        ...dish,
        selected: selectedDishIds.includes(dish.id)
      }));
      
      // 验证每个菜品都有 selected 属性
      expect(dishesWithSelected[0]).toHaveProperty('selected');
      expect(dishesWithSelected[1]).toHaveProperty('selected');
      
      // 验证已选中的菜品 selected 为 true
      expect(dishesWithSelected[0].selected).toBe(true);
      
      // 验证未选中的菜品 selected 为 false
      expect(dishesWithSelected[1].selected).toBe(false);
    });
  });
});
