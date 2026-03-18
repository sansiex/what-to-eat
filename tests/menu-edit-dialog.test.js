/**
 * 菜单编辑页面 - 新增菜品弹窗测试
 * 测试驱动开发 - 验证弹窗功能和样式
 */

const path = require('path');

describe('菜单编辑页面 - 新增菜品弹窗测试', () => {
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

  describe('弹窗数据状态测试', () => {
    test('验证初始状态弹窗隐藏', () => {
      expect(pageInstance.data.showAddDishDialog).toBe(false);
    });

    test('验证 showAddDishDialog 方法显示弹窗', () => {
      pageInstance.showAddDishDialog();
      
      expect(pageInstance.setData).toHaveBeenCalledWith(
        expect.objectContaining({
          showAddDishDialog: true,
          newDishName: ''
        })
      );
    });

    test('验证 hideAddDishDialog 方法隐藏弹窗', () => {
      // 先显示弹窗
      pageInstance.data.showAddDishDialog = true;
      pageInstance.data.newDishName = '测试菜品';
      
      // 调用隐藏方法
      pageInstance.hideAddDishDialog();
      
      expect(pageInstance.setData).toHaveBeenCalledWith(
        expect.objectContaining({
          showAddDishDialog: false,
          newDishName: ''
        })
      );
    });
  });

  describe('弹窗输入功能测试', () => {
    test('验证 onNewDishNameInput 更新输入值', () => {
      const mockEvent = {
        detail: { value: '红烧肉' }
      };
      
      pageInstance.onNewDishNameInput(mockEvent);
      
      expect(pageInstance.setData).toHaveBeenCalledWith({
        newDishName: '红烧肉'
      });
    });

    test('验证 confirmAddDish 空值校验', () => {
      pageInstance.data.newDishName = '';
      
      pageInstance.confirmAddDish();
      
      // 验证显示提示
      expect(wx.showToast).toHaveBeenCalledWith({
        title: '请输入菜品名称',
        icon: 'none'
      });
    });

    test('验证 confirmAddDish 空白字符校验', () => {
      pageInstance.data.newDishName = '   ';
      
      pageInstance.confirmAddDish();
      
      // 验证显示提示
      expect(wx.showToast).toHaveBeenCalledWith({
        title: '请输入菜品名称',
        icon: 'none'
      });
    });
  });

  describe('WXML 结构测试', () => {
    test('验证弹窗使用正确的条件渲染', () => {
      const fs = require('fs');
      const wxmlPath = path.join(__dirname, '../pages/menu-edit/menu-edit.wxml');
      const wxmlContent = fs.readFileSync(wxmlPath, 'utf-8');
      
      // 验证使用 wx:if 控制弹窗显示
      expect(wxmlContent).toMatch(/wx:if="\{\{showAddDishDialog\}\}"/);
    });

    test('验证弹窗包含正确的结构元素', () => {
      const fs = require('fs');
      const wxmlPath = path.join(__dirname, '../pages/menu-edit/menu-edit.wxml');
      const wxmlContent = fs.readFileSync(wxmlPath, 'utf-8');
      
      // 验证包含弹窗遮罩层
      expect(wxmlContent).toMatch(/class="dialog-overlay"/);
      
      // 验证包含弹窗容器
      expect(wxmlContent).toMatch(/class="dialog"/);
      
      // 验证包含标题
      expect(wxmlContent).toMatch(/class="dialog-title"/);
      expect(wxmlContent).toContain('新增菜品');
      
      // 验证包含关闭按钮
      expect(wxmlContent).toMatch(/class="dialog-close"/);
      
      // 验证包含输入框
      expect(wxmlContent).toMatch(/placeholder="请输入菜品名称"/);
      
      // 验证包含按钮区域
      expect(wxmlContent).toMatch(/class="dialog-actions"/);
      
      // 验证包含取消和确定按钮
      expect(wxmlContent).toContain('取消');
      expect(wxmlContent).toContain('确定');
    });

    test('验证弹窗按钮绑定正确的事件', () => {
      const fs = require('fs');
      const wxmlPath = path.join(__dirname, '../pages/menu-edit/menu-edit.wxml');
      const wxmlContent = fs.readFileSync(wxmlPath, 'utf-8');
      
      // 验证取消按钮绑定 hideAddDishDialog
      expect(wxmlContent).toMatch(/bindtap="hideAddDishDialog"/);
      
      // 验证确定按钮绑定 confirmAddDish
      expect(wxmlContent).toMatch(/bindtap="confirmAddDish"/);
      
      // 验证关闭按钮绑定 hideAddDishDialog
      expect(wxmlContent).toMatch(/class="dialog-close"[^>]*bindtap="hideAddDishDialog"/);
    });

    test('验证输入框绑定正确的事件和属性', () => {
      const fs = require('fs');
      const wxmlPath = path.join(__dirname, '../pages/menu-edit/menu-edit.wxml');
      const wxmlContent = fs.readFileSync(wxmlPath, 'utf-8');
      
      // 验证输入框绑定输入事件
      expect(wxmlContent).toMatch(/bindinput="onNewDishNameInput"/);
      
      // 验证输入框绑定值
      expect(wxmlContent).toMatch(/value="\{\{newDishName\}\}"/);
      
      // 验证输入框自动聚焦
      expect(wxmlContent).toMatch(/focus="\{\{showAddDishDialog\}\}"/);
    });
  });

  describe('WXSS 样式测试', () => {
    test('验证弹窗样式文件存在关键样式', () => {
      const fs = require('fs');
      const wxssPath = path.join(__dirname, '../pages/menu-edit/menu-edit.wxss');
      const wxssContent = fs.readFileSync(wxssPath, 'utf-8');
      
      // 验证弹窗遮罩层样式
      expect(wxssContent).toMatch(/\.dialog-overlay\s*\{/);
      expect(wxssContent).toMatch(/position:\s*fixed/);
      expect(wxssContent).toMatch(/z-index:\s*1000/);
      
      // 验证弹窗容器样式
      expect(wxssContent).toMatch(/\.dialog\s*\{/);
      expect(wxssContent).toMatch(/width:\s*80%/);
      expect(wxssContent).toMatch(/max-width:/);
      
      // 验证按钮区域样式
      expect(wxssContent).toMatch(/\.dialog-actions\s*\{/);
      expect(wxssContent).toMatch(/display:\s*flex/);
      
      // 验证按钮样式
      expect(wxssContent).toMatch(/\.dialog-actions\s+\.btn/);
      expect(wxssContent).toMatch(/\.btn-cancel/);
      expect(wxssContent).toMatch(/\.btn-confirm/);
    });

    test('验证按钮并排显示样式', () => {
      const fs = require('fs');
      const wxssPath = path.join(__dirname, '../pages/menu-edit/menu-edit.wxss');
      const wxssContent = fs.readFileSync(wxssPath, 'utf-8');
      
      // 验证按钮区域使用 flex 布局
      expect(wxssContent).toMatch(/\.dialog-actions\s*\{[^}]*display:\s*flex/s);
      
      // 验证按钮有 flex: 1 属性
      expect(wxssContent).toMatch(/flex:\s*1/);
    });

    test('验证确定按钮有渐变背景', () => {
      const fs = require('fs');
      const wxssPath = path.join(__dirname, '../pages/menu-edit/menu-edit.wxss');
      const wxssContent = fs.readFileSync(wxssPath, 'utf-8');
      
      // 验证确定按钮有渐变背景
      expect(wxssContent).toMatch(/\.btn-confirm\s*\{[^}]*background:\s*linear-gradient/s);
    });
  });
});
