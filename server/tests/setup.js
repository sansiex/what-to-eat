/**
 * 测试环境配置
 * 提供测试数据库连接和测试工具函数
 */

const mysql = require('mysql2/promise');

// 测试数据库配置
// 本地测试使用 localhost，CI/CD 或云环境通过环境变量配置
const testDbConfig = {
  host: process.env.TEST_DB_HOST || 'localhost',
  port: parseInt(process.env.TEST_DB_PORT || '3306'),
  user: process.env.TEST_DB_USER || 'root',
  password: process.env.TEST_DB_PASSWORD || '',
  database: process.env.TEST_DB_NAME || 'what_to_eat_test',
  timezone: '+08:00',
  charset: 'utf8mb4',
  connectTimeout: 10000,
  acquireTimeout: 10000
};

// 创建测试数据库连接池
let testPool = null;

/**
 * 获取测试数据库连接池
 * @returns {Object} 连接池
 */
function getTestPool() {
  if (!testPool) {
    testPool = mysql.createPool(testDbConfig);
  }
  return testPool;
}

/**
 * 执行测试SQL
 * @param {string} sql - SQL语句
 * @param {Array} params - 参数
 * @returns {Promise} 查询结果
 */
async function testQuery(sql, params = []) {
  const pool = getTestPool();
  const [results] = await pool.execute(sql, params);
  return results;
}

/**
 * 清理测试数据
 * 在每次测试前调用，确保数据干净
 */
async function cleanupTestData() {
  const tables = ['wte_orders', 'wte_meal_dishes', 'wte_meals', 'wte_dishes', 'wte_kitchens', 'wte_users'];
  for (const table of tables) {
    await testQuery(`DELETE FROM ${table}`);
  }
}

/**
 * 创建测试用户
 * @param {Object} userData - 用户数据
 * @returns {Promise<number>} 用户ID
 */
async function createTestUser(userData = {}) {
  const { openid = 'test_openid_' + Date.now(), nickname = '测试用户', avatarUrl = null } = userData;
  const result = await testQuery(
    'INSERT INTO wte_users (openid, nickname, avatar_url) VALUES (?, ?, ?)',
    [openid, nickname, avatarUrl]
  );
  const userId = result.insertId;
  
  // 自动创建默认厨房
  await createTestKitchen(userId, { isDefault: true });
  
  return userId;
}

/**
 * 创建测试厨房
 * @param {number} userId - 用户ID
 * @param {Object} kitchenData - 厨房数据
 * @returns {Promise<number>} 厨房ID
 */
async function createTestKitchen(userId, kitchenData = {}) {
  const { 
    name = '我的厨房', 
    description = '默认厨房', 
    isDefault = true 
  } = kitchenData;
  
  const result = await testQuery(
    'INSERT INTO wte_kitchens (user_id, name, description, is_default) VALUES (?, ?, ?, ?)',
    [userId, name, description, isDefault ? 1 : 0]
  );
  return result.insertId;
}

/**
 * 创建测试菜品
 * @param {number} userId - 用户ID
 * @param {number} kitchenId - 厨房ID
 * @param {Object} dishData - 菜品数据
 * @returns {Promise<number>} 菜品ID
 */
async function createTestDish(userId, kitchenId, dishData = {}) {
  const { name = '测试菜品' + Date.now(), description = '测试描述' } = dishData;
  const result = await testQuery(
    'INSERT INTO wte_dishes (user_id, kitchen_id, name, description) VALUES (?, ?, ?, ?)',
    [userId, kitchenId, name, description]
  );
  return result.insertId;
}

/**
 * 创建测试点餐活动
 * @param {number} userId - 用户ID
 * @param {number} kitchenId - 厨房ID
 * @param {Object} mealData - 点餐数据
 * @returns {Promise<number>} 点餐ID
 */
async function createTestMeal(userId, kitchenId, mealData = {}) {
  const { name = '测试点餐' + Date.now(), status = 1 } = mealData;
  const result = await testQuery(
    'INSERT INTO wte_meals (user_id, kitchen_id, name, status) VALUES (?, ?, ?, ?)',
    [userId, kitchenId, name, status]
  );
  return result.insertId;
}

/**
 * 关联菜品到点餐活动
 * @param {number} mealId - 点餐ID
 * @param {number} dishId - 菜品ID
 */
async function linkDishToMeal(mealId, dishId) {
  await testQuery(
    'INSERT INTO wte_meal_dishes (meal_id, dish_id) VALUES (?, ?)',
    [mealId, dishId]
  );
}

/**
 * 创建测试订单
 * @param {number} mealId - 点餐ID
 * @param {number} userId - 用户ID
 * @param {number} dishId - 菜品ID
 * @returns {Promise<number>} 订单ID
 */
async function createTestOrder(mealId, userId, dishId) {
  const result = await testQuery(
    'INSERT INTO wte_orders (meal_id, user_id, dish_id) VALUES (?, ?, ?)',
    [mealId, userId, dishId]
  );
  return result.insertId;
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

module.exports = {
  getTestPool,
  testQuery,
  cleanupTestData,
  createTestUser,
  createTestKitchen,
  createTestDish,
  createTestMeal,
  linkDishToMeal,
  createTestOrder,
  mockContext,
  testDbConfig
};
