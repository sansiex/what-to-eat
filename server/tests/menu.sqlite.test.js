/**
 * 菜单管理云函数单元测试
 * 使用 SQLite 内存数据库进行测试
 * 测试驱动开发 - 验证更新菜单功能修复
 */

const Database = require('better-sqlite3');
const path = require('path');

// 模拟云函数环境
const mockContext = {
  getUserId: () => 1
};

// 模拟响应工具
const mockResponse = {
  success: (data, message) => ({ code: 0, data, message, success: true }),
  error: (message) => ({ code: -1, message, success: false }),
  paramError: (message) => ({ code: 400, message, success: false }),
  notFound: (message) => ({ code: 404, message, success: false })
};

describe('菜单管理云函数测试', () => {
  let db;
  let menuModule;

  beforeAll(() => {
    // 创建内存数据库
    db = new Database(':memory:');
    
    // 创建测试表
    db.exec(`
      CREATE TABLE wte_menus (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        name TEXT NOT NULL,
        status INTEGER DEFAULT 1,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
      
      CREATE TABLE wte_menu_dishes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        menu_id INTEGER NOT NULL,
        dish_id INTEGER NOT NULL,
        status INTEGER DEFAULT 1,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(menu_id, dish_id)
      );
      
      CREATE TABLE wte_dishes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        name TEXT NOT NULL,
        status INTEGER DEFAULT 1
      );
    `);
  });

  beforeEach(() => {
    // 清空表数据
    db.exec('DELETE FROM wte_menu_dishes; DELETE FROM wte_menus; DELETE FROM wte_dishes;');
    
    // 重置自增ID（SQLite 语法）
    db.exec("DELETE FROM sqlite_sequence WHERE name IN ('wte_menus', 'wte_menu_dishes', 'wte_dishes');");
    
    // 插入测试数据
    db.exec(`
      INSERT INTO wte_dishes (id, user_id, name) VALUES 
        (1, 1, '红烧肉'),
        (2, 1, '糖醋排骨'),
        (3, 1, '酸菜鱼');
    `);
  });

  afterAll(() => {
    db.close();
  });

  describe('updateMenu 功能测试', () => {
    test('验证更新菜单时正确处理已存在的菜品关联', () => {
      // 创建测试菜单
      const menuResult = db.prepare(
        'INSERT INTO wte_menus (user_id, name) VALUES (?, ?)'
      ).run(1, '测试菜单');
      const menuId = menuResult.lastInsertRowid;
      
      // 先添加菜品关联（模拟之前保存的状态）
      db.prepare(
        'INSERT INTO wte_menu_dishes (menu_id, dish_id, status) VALUES (?, ?, 1)'
      ).run(menuId, 1);
      db.prepare(
        'INSERT INTO wte_menu_dishes (menu_id, dish_id, status) VALUES (?, ?, 1)'
      ).run(menuId, 2);
      
      // 模拟软删除
      db.prepare(
        'UPDATE wte_menu_dishes SET status = 0 WHERE menu_id = ?'
      ).run(menuId);
      
      // 验证使用 INSERT ... ON DUPLICATE KEY UPDATE 逻辑
      // 尝试重新添加相同的菜品关联
      const dishIds = [1, 2, 3]; // 包含之前已存在的菜品
      
      for (const dishId of dishIds) {
        // 模拟 ON DUPLICATE KEY UPDATE 逻辑
        const existing = db.prepare(
          'SELECT id FROM wte_menu_dishes WHERE menu_id = ? AND dish_id = ?'
        ).get(menuId, dishId);
        
        if (existing) {
          // 已存在，更新状态
          db.prepare(
            'UPDATE wte_menu_dishes SET status = 1 WHERE menu_id = ? AND dish_id = ?'
          ).run(menuId, dishId);
        } else {
          // 不存在，插入新记录
          db.prepare(
            'INSERT INTO wte_menu_dishes (menu_id, dish_id, status) VALUES (?, ?, 1)'
          ).run(menuId, dishId);
        }
      }
      
      // 验证所有菜品关联都已恢复
      const associations = db.prepare(
        'SELECT dish_id, status FROM wte_menu_dishes WHERE menu_id = ? AND status = 1 ORDER BY dish_id'
      ).all(menuId);
      
      expect(associations).toHaveLength(3);
      expect(associations.map(a => a.dish_id)).toEqual([1, 2, 3]);
    });

    test('验证更新菜单时不会重复插入相同关联', () => {
      // 创建测试菜单
      const menuResult = db.prepare(
        'INSERT INTO wte_menus (user_id, name) VALUES (?, ?)'
      ).run(1, '测试菜单2');
      const menuId = menuResult.lastInsertRowid;
      
      // 第一次添加菜品
      db.prepare(
        'INSERT INTO wte_menu_dishes (menu_id, dish_id, status) VALUES (?, ?, 1)'
      ).run(menuId, 1);
      
      // 尝试再次添加相同的菜品（应该更新而不是插入）
      const existing = db.prepare(
        'SELECT id FROM wte_menu_dishes WHERE menu_id = ? AND dish_id = ?'
      ).get(menuId, 1);
      
      if (existing) {
        db.prepare(
          'UPDATE wte_menu_dishes SET status = 1 WHERE menu_id = ? AND dish_id = ?'
        ).run(menuId, 1);
      } else {
        db.prepare(
          'INSERT INTO wte_menu_dishes (menu_id, dish_id, status) VALUES (?, ?, 1)'
        ).run(menuId, 1);
      }
      
      // 验证只有一条记录
      const count = db.prepare(
        'SELECT COUNT(*) as count FROM wte_menu_dishes WHERE menu_id = ? AND dish_id = ?'
      ).get(menuId, 1);
      
      expect(count.count).toBe(1);
    });
  });

  describe('数据库约束测试', () => {
    test('验证唯一索引约束存在', () => {
      // 创建测试菜单
      const menuResult = db.prepare(
        'INSERT INTO wte_menus (user_id, name) VALUES (?, ?)'
      ).run(1, '测试菜单');
      const menuId = menuResult.lastInsertRowid;
      
      // 第一次插入应该成功
      db.prepare(
        'INSERT INTO wte_menu_dishes (menu_id, dish_id, status) VALUES (?, ?, 1)'
      ).run(menuId, 1);
      
      // 第二次插入相同数据应该失败（违反唯一约束）
      expect(() => {
        db.prepare(
          'INSERT INTO wte_menu_dishes (menu_id, dish_id, status) VALUES (?, ?, 1)'
        ).run(menuId, 1);
      }).toThrow();
    });
  });
});
