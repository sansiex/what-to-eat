/**
 * SQLite 内存数据库测试配置
 * 提供轻量级的内存数据库测试环境，无需外部 MySQL 服务
 */

const Database = require('better-sqlite3');

// 创建内存数据库实例
let db = null;

/**
 * 获取数据库实例（单例模式）
 * @returns {Database} SQLite 数据库实例
 */
function getTestDB() {
  if (!db) {
    db = new Database(':memory:');
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = OFF');
  }
  return db;
}

/**
 * 初始化数据库表结构
 */
function initSchema() {
  const database = getTestDB();
  
  // 用户表
  database.exec(`
    CREATE TABLE IF NOT EXISTS wte_users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      openid TEXT NOT NULL UNIQUE,
      nickname TEXT,
      avatar_url TEXT,
      status INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      last_login_at DATETIME
    );
    CREATE INDEX IF NOT EXISTS idx_openid ON wte_users(openid);
    CREATE INDEX IF NOT EXISTS idx_status ON wte_users(status);
  `);
  
  // 厨房表
  database.exec(`
    CREATE TABLE IF NOT EXISTS wte_kitchens (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      description TEXT,
      is_default INTEGER DEFAULT 0,
      status INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX IF NOT EXISTS idx_kitchen_user_id ON wte_kitchens(user_id);
    CREATE INDEX IF NOT EXISTS idx_kitchen_is_default ON wte_kitchens(is_default);
    CREATE INDEX IF NOT EXISTS idx_kitchen_status ON wte_kitchens(status);
  `);
  
  // 菜品表
  database.exec(`
    CREATE TABLE IF NOT EXISTS wte_dishes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      kitchen_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      description TEXT,
      status INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX IF NOT EXISTS idx_dish_user_id ON wte_dishes(user_id);
    CREATE INDEX IF NOT EXISTS idx_dish_kitchen_id ON wte_dishes(kitchen_id);
    CREATE INDEX IF NOT EXISTS idx_dish_status ON wte_dishes(status);
  `);
  
  // 点餐表
  database.exec(`
    CREATE TABLE IF NOT EXISTS wte_meals (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      kitchen_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      status INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      closed_at DATETIME
    );
    CREATE INDEX IF NOT EXISTS idx_meal_user_id ON wte_meals(user_id);
    CREATE INDEX IF NOT EXISTS idx_meal_kitchen_id ON wte_meals(kitchen_id);
    CREATE INDEX IF NOT EXISTS idx_meal_status ON wte_meals(status);
  `);
  
  // 点餐菜品关联表
  database.exec(`
    CREATE TABLE IF NOT EXISTS wte_meal_dishes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      meal_id INTEGER NOT NULL,
      dish_id INTEGER NOT NULL,
      status INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX IF NOT EXISTS idx_md_meal_id ON wte_meal_dishes(meal_id);
    CREATE INDEX IF NOT EXISTS idx_md_dish_id ON wte_meal_dishes(dish_id);
    CREATE INDEX IF NOT EXISTS idx_md_status ON wte_meal_dishes(status);
  `);
  
  // 订单表
  database.exec(`
    CREATE TABLE IF NOT EXISTS wte_orders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      meal_id INTEGER NOT NULL,
      user_id INTEGER NOT NULL,
      dish_id INTEGER NOT NULL,
      status INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      canceled_at DATETIME
    );
    CREATE INDEX IF NOT EXISTS idx_order_meal_id ON wte_orders(meal_id);
    CREATE INDEX IF NOT EXISTS idx_order_user_id ON wte_orders(user_id);
    CREATE INDEX IF NOT EXISTS idx_order_dish_id ON wte_orders(dish_id);
    CREATE INDEX IF NOT EXISTS idx_order_status ON wte_orders(status);
  `);
}

/**
 * 执行 SQL 查询
 * @param {string} sql - SQL 语句
 * @param {Array} params - 参数
 * @returns {Array|Object} 查询结果
 */
function testQuery(sql, params = []) {
  const database = getTestDB();
  
  // 对于 SQLite，直接使用 ? 占位符和位置参数
  // 处理 INSERT 语句
  if (sql.trim().toLowerCase().startsWith('insert')) {
    const stmt = database.prepare(sql);
    const result = stmt.run(...params);
    return { insertId: result.lastInsertRowid };
  }
  
  // 处理 UPDATE/DELETE 语句
  if (sql.trim().toLowerCase().startsWith('update') || sql.trim().toLowerCase().startsWith('delete')) {
    const stmt = database.prepare(sql);
    const result = stmt.run(...params);
    return { affectedRows: result.changes };
  }
  
  // 处理 SELECT 语句
  const stmt = database.prepare(sql);
  const rows = stmt.all(...params);
  
  // 转换字段名（下划线转驼峰）
  return rows.map(row => {
    const converted = {};
    for (const [key, value] of Object.entries(row)) {
      const camelKey = key.replace(/_([a-z])/g, (match, letter) => letter.toUpperCase());
      converted[camelKey] = value;
    }
    return converted;
  });
}

/**
 * 清理测试数据
 */
function cleanupTestData() {
  const database = getTestDB();
  const tables = ['wte_orders', 'wte_meal_dishes', 'wte_meals', 'wte_dishes', 'wte_kitchens', 'wte_users'];
  for (const table of tables) {
    database.exec(`DELETE FROM ${table}`);
  }
}

/**
 * 创建测试用户
 * @param {Object} userData - 用户数据
 * @returns {number} 用户ID
 */
function createTestUser(userData = {}) {
  const database = getTestDB();
  const { openid = 'test_openid_' + Date.now(), nickname = '测试用户', avatarUrl = null } = userData;
  
  const stmt = database.prepare(
    'INSERT INTO wte_users (openid, nickname, avatar_url) VALUES (?, ?, ?)'
  );
  const result = stmt.run(openid, nickname, avatarUrl);
  const userId = result.lastInsertRowid;
  
  // 自动创建默认厨房
  createTestKitchen(userId, { isDefault: true });
  
  return userId;
}

/**
 * 创建测试厨房
 * @param {number} userId - 用户ID
 * @param {Object} kitchenData - 厨房数据
 * @returns {number} 厨房ID
 */
function createTestKitchen(userId, kitchenData = {}) {
  const database = getTestDB();
  const { 
    name = '我的厨房', 
    description = '默认厨房', 
    isDefault = true 
  } = kitchenData;
  
  const stmt = database.prepare(
    'INSERT INTO wte_kitchens (user_id, name, description, is_default) VALUES (?, ?, ?, ?)'
  );
  const result = stmt.run(userId, name, description, isDefault ? 1 : 0);
  return result.lastInsertRowid;
}

/**
 * 创建测试菜品
 * @param {number} userId - 用户ID
 * @param {number} kitchenId - 厨房ID
 * @param {Object} dishData - 菜品数据
 * @returns {number} 菜品ID
 */
function createTestDish(userId, kitchenId, dishData = {}) {
  const database = getTestDB();
  const { name = '测试菜品' + Date.now(), description = '测试描述' } = dishData;
  
  const stmt = database.prepare(
    'INSERT INTO wte_dishes (user_id, kitchen_id, name, description) VALUES (?, ?, ?, ?)'
  );
  const result = stmt.run(userId, kitchenId, name, description);
  return result.lastInsertRowid;
}

/**
 * 创建测试点餐活动
 * @param {number} userId - 用户ID
 * @param {number} kitchenId - 厨房ID
 * @param {Object} mealData - 点餐数据
 * @returns {number} 点餐ID
 */
function createTestMeal(userId, kitchenId, mealData = {}) {
  const database = getTestDB();
  const { name = '测试点餐' + Date.now(), status = 1 } = mealData;
  
  const stmt = database.prepare(
    'INSERT INTO wte_meals (user_id, kitchen_id, name, status) VALUES (?, ?, ?, ?)'
  );
  const result = stmt.run(userId, kitchenId, name, status);
  return result.lastInsertRowid;
}

/**
 * 关联菜品到点餐活动
 * @param {number} mealId - 点餐ID
 * @param {number} dishId - 菜品ID
 */
function linkDishToMeal(mealId, dishId) {
  const database = getTestDB();
  const stmt = database.prepare(
    'INSERT INTO wte_meal_dishes (meal_id, dish_id) VALUES (?, ?)'
  );
  stmt.run(mealId, dishId);
}

/**
 * 创建测试订单
 * @param {number} mealId - 点餐ID
 * @param {number} userId - 用户ID
 * @param {number} dishId - 菜品ID
 * @returns {number} 订单ID
 */
function createTestOrder(mealId, userId, dishId) {
  const database = getTestDB();
  const stmt = database.prepare(
    'INSERT INTO wte_orders (meal_id, user_id, dish_id) VALUES (?, ?, ?)'
  );
  const result = stmt.run(mealId, userId, dishId);
  return result.lastInsertRowid;
}

/**
 * 模拟云函数上下文
 * @param {number} userId - 用户ID
 * @returns {Object} 模拟上下文
 */
function mockContext(userId = 1) {
  return {
    userId,
    openid: 'mock_openid_' + userId
  };
}

/**
 * 关闭数据库连接
 */
function closeTestDB() {
  if (db) {
    db.close();
    db = null;
  }
}

// 初始化数据库
initSchema();

module.exports = {
  getTestDB,
  testQuery,
  cleanupTestData,
  createTestUser,
  createTestKitchen,
  createTestDish,
  createTestMeal,
  linkDishToMeal,
  createTestOrder,
  mockContext,
  closeTestDB
};
