#!/usr/bin/env node
/**
 * 简单的测试运行器 - 绕过npm环境问题
 * 使用Node.js内置模块运行测试
 */

const fs = require('fs');
const path = require('path');

// 简单的测试框架
class TestRunner {
  constructor() {
    this.tests = [];
    this.passed = 0;
    this.failed = 0;
  }

  describe(name, fn) {
    console.log(`\n${name}`);
    fn();
  }

  test(name, fn) {
    try {
      fn();
      this.passed++;
      console.log(`  ✓ ${name}`);
    } catch (err) {
      this.failed++;
      console.log(`  ✗ ${name}`);
      console.log(`    ${err.message}`);
    }
  }

  beforeEach(fn) {
    this.beforeEachFn = fn;
  }

  expect(actual) {
    return {
      toBe(expected) {
        if (actual !== expected) {
          throw new Error(`Expected ${expected} but got ${actual}`);
        }
      },
      toEqual(expected) {
        if (JSON.stringify(actual) !== JSON.stringify(expected)) {
          throw new Error(`Expected ${JSON.stringify(expected)} but got ${JSON.stringify(actual)}`);
        }
      },
      toBeDefined() {
        if (actual === undefined) {
          throw new Error(`Expected value to be defined`);
        }
      },
      toBeNull() {
        if (actual !== null) {
          throw new Error(`Expected null but got ${actual}`);
        }
      },
      toBeTruthy() {
        if (!actual) {
          throw new Error(`Expected truthy value but got ${actual}`);
        }
      },
      toBeFalsy() {
        if (actual) {
          throw new Error(`Expected falsy value but got ${actual}`);
        }
      },
      toHaveLength(expected) {
        if (actual.length !== expected) {
          throw new Error(`Expected length ${expected} but got ${actual.length}`);
        }
      },
      toContain(item) {
        if (!actual.includes(item)) {
          throw new Error(`Expected ${JSON.stringify(actual)} to contain ${item}`);
        }
      },
      not: {
        toContain(item) {
          if (actual.includes(item)) {
            throw new Error(`Expected ${JSON.stringify(actual)} not to contain ${item}`);
          }
        },
        toHaveBeenCalled() {
          if (actual._called) {
            throw new Error(`Expected not to have been called`);
          }
        }
      },
      toHaveBeenCalled() {
        if (!actual._called) {
          throw new Error(`Expected to have been called`);
        }
      },
      toHaveBeenCalledWith(...args) {
        if (!actual._called) {
          throw new Error(`Expected to have been called`);
        }
        const match = actual._calls.some(call => 
          JSON.stringify(call) === JSON.stringify(args)
        );
        if (!match) {
          throw new Error(`Expected to have been called with ${JSON.stringify(args)}`);
        }
      }
    };
  }

  fn() {
    const mockFn = (...args) => {
      mockFn._called = true;
      mockFn._calls.push(args);
      return mockFn._returnValue;
    };
    mockFn._called = false;
    mockFn._calls = [];
    mockFn._returnValue = undefined;
    mockFn.mockResolvedValue = (val) => {
      mockFn._returnValue = val;
      return mockFn;
    };
    mockFn.mockImplementation = (fn) => {
      mockFn._impl = fn;
      return mockFn;
    };
    return mockFn;
  }

  run() {
    console.log('\n========================================');
    console.log('Test Results');
    console.log('========================================');
    console.log(`Passed: ${this.passed}`);
    console.log(`Failed: ${this.failed}`);
    console.log(`Total: ${this.passed + this.failed}`);
    
    if (this.failed === 0) {
      console.log('\n✓ All tests passed!');
      process.exit(0);
    } else {
      console.log(`\n✗ ${this.failed} test(s) failed`);
      process.exit(1);
    }
  }
}

// 全局测试函数
global.describe = (name, fn) => testRunner.describe(name, fn);
global.test = (name, fn) => testRunner.test(name, fn);
global.beforeEach = (fn) => testRunner.beforeEach(fn);
global.expect = (actual) => testRunner.expect(actual);
global.jest = {
  fn: () => testRunner.fn(),
  clearAllMocks: () => {},
  mock: () => {}
};

const testRunner = new TestRunner();

// 运行App配置测试
console.log('Running App Config Tests...');

// 读取app.json
const appConfig = JSON.parse(fs.readFileSync('./app.json', 'utf-8'));

describe('App配置测试 - Tab页重构', () => {
  test('验证tabBar配置存在', () => {
    expect(appConfig.tabBar).toBeDefined();
    expect(appConfig.tabBar.list).toBeDefined();
  });

  test('验证tabBar包含3个tab项', () => {
    expect(appConfig.tabBar.list).toHaveLength(3);
  });

  test('验证第一个tab是【菜单】', () => {
    expect(appConfig.tabBar.list[0].text).toBe('菜单');
    expect(appConfig.tabBar.list[0].pagePath).toBe('pages/menu-list/menu-list');
  });

  test('验证第二个tab是【菜品】', () => {
    expect(appConfig.tabBar.list[1].text).toBe('菜品');
    expect(appConfig.tabBar.list[1].pagePath).toBe('pages/dish-list/dish-list');
  });

  test('验证第三个tab是【点餐】', () => {
    expect(appConfig.tabBar.list[2].text).toBe('点餐');
    expect(appConfig.tabBar.list[2].pagePath).toBe('pages/meal-list/meal-list');
  });

  test('验证pages配置包含所有必要页面', () => {
    expect(appConfig.pages).toContain('pages/menu-list/menu-list');
    expect(appConfig.pages).toContain('pages/dish-list/dish-list');
    expect(appConfig.pages).toContain('pages/menu-edit/menu-edit');
  });
});

// 运行cloud-api.js测试
describe('Cloud API测试 - Menu API', () => {
  const cloudApiContent = fs.readFileSync('./utils/cloud-api.js', 'utf-8');
  
  test('验证menu API存在', () => {
    expect(cloudApiContent).toContain('menu:');
  });

  test('验证menu.list方法存在', () => {
    expect(cloudApiContent).toContain('list()');
  });

  test('验证menu.create方法存在', () => {
    expect(cloudApiContent).toContain('create(data)');
  });

  test('验证menu.update方法存在', () => {
    expect(cloudApiContent).toContain('update(data)');
  });

  test('验证menu.delete方法存在', () => {
    expect(cloudApiContent).toContain('delete(id)');
  });
});

// 运行页面文件存在性测试
describe('页面文件存在性测试', () => {
  const pages = [
    'pages/menu-list/menu-list.js',
    'pages/menu-list/menu-list.wxml',
    'pages/menu-list/menu-list.wxss',
    'pages/menu-edit/menu-edit.js',
    'pages/menu-edit/menu-edit.wxml',
    'pages/menu-edit/menu-edit.wxss',
    'pages/dish-list/dish-list.js',
    'pages/dish-list/dish-list.wxml',
    'pages/dish-list/dish-list.wxss'
  ];

  pages.forEach(page => {
    test(`验证 ${page} 存在`, () => {
      expect(fs.existsSync(page)).toBeTruthy();
    });
  });
});

// 运行云函数文件存在性测试
describe('云函数文件存在性测试', () => {
  test('验证menu云函数index.js存在', () => {
    expect(fs.existsSync('server/functions/menu/index.js')).toBeTruthy();
  });

  test('验证menu云函数package.json存在', () => {
    expect(fs.existsSync('server/functions/menu/package.json')).toBeTruthy();
  });

  test('验证menu云函数utils/db.js存在', () => {
    expect(fs.existsSync('server/functions/menu/utils/db.js')).toBeTruthy();
  });

  test('验证menu云函数utils/response.js存在', () => {
    expect(fs.existsSync('server/functions/menu/utils/response.js')).toBeTruthy();
  });
});

// 运行菜单列表页面功能测试
describe('菜单列表页面功能测试', () => {
  const menuListJs = fs.readFileSync('./pages/menu-list/menu-list.js', 'utf-8');
  const menuListWxml = fs.readFileSync('./pages/menu-list/menu-list.wxml', 'utf-8');

  test('验证loadMenus方法存在', () => {
    expect(menuListJs).toContain('loadMenus');
  });

  test('验证createMenu方法存在', () => {
    expect(menuListJs).toContain('createMenu');
  });

  test('验证editMenu方法存在', () => {
    expect(menuListJs).toContain('editMenu');
  });

  test('验证deleteMenu方法存在', () => {
    expect(menuListJs).toContain('deleteMenu');
  });

  test('验证goInitiateMeal方法存在', () => {
    expect(menuListJs).toContain('goInitiateMeal');
  });

  test('验证WXML包含创建菜单按钮', () => {
    expect(menuListWxml).toContain('创建菜单');
  });

  test('验证WXML包含编辑按钮', () => {
    expect(menuListWxml).toContain('编辑');
  });

  test('验证WXML包含删除按钮', () => {
    expect(menuListWxml).toContain('删除');
  });

  test('验证WXML包含发起点餐按钮', () => {
    expect(menuListWxml).toContain('发起点餐');
  });
});

// 运行菜单编辑页面功能测试
describe('菜单编辑页面功能测试', () => {
  const menuEditJs = fs.readFileSync('./pages/menu-edit/menu-edit.js', 'utf-8');
  const menuEditWxml = fs.readFileSync('./pages/menu-edit/menu-edit.wxml', 'utf-8');

  test('验证loadAllDishes方法存在', () => {
    expect(menuEditJs).toContain('loadAllDishes');
  });

  test('验证toggleDishSelection方法存在', () => {
    expect(menuEditJs).toContain('toggleDishSelection');
  });

  test('验证showAddDishDialog方法存在', () => {
    expect(menuEditJs).toContain('showAddDishDialog');
  });

  test('验证confirmAddDish方法存在', () => {
    expect(menuEditJs).toContain('confirmAddDish');
  });

  test('验证saveMenu方法存在', () => {
    expect(menuEditJs).toContain('saveMenu');
  });

  test('验证WXML包含菜品搜索框', () => {
    expect(menuEditWxml).toContain('搜索菜品');
  });

  test('验证WXML包含新增菜品按钮', () => {
    expect(menuEditWxml).toContain('新增菜品');
  });

  test('验证WXML包含checkbox', () => {
    expect(menuEditWxml).toContain('checkbox');
  });
});

// 运行菜品列表页面功能测试
describe('菜品列表页面功能测试', () => {
  const dishListJs = fs.readFileSync('./pages/dish-list/dish-list.js', 'utf-8');

  test('验证loadDishes方法存在', () => {
    expect(dishListJs).toContain('loadDishes');
  });

  test('验证showAddDialog方法存在', () => {
    expect(dishListJs).toContain('showAddDialog');
  });

  test('验证addDish方法存在', () => {
    expect(dishListJs).toContain('addDish');
  });

  test('验证deleteDish方法存在', () => {
    expect(dishListJs).toContain('deleteDish');
  });
});

// 输出结果
testRunner.run();
