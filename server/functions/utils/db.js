/**
 * 数据库连接工具
 * 使用腾讯云MySQL数据库
 */

const mysql = require('mysql2/promise');

// 数据库配置
const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '3306'),
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'what_to_eat',
  // 连接池配置
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  // 时区配置
  timezone: '+08:00',
  // 字符集
  charset: 'utf8mb4'
};

// 创建连接池
const pool = mysql.createPool(dbConfig);

/**
 * 执行SQL查询
 * @param {string} sql - SQL语句
 * @param {Array} params - 查询参数
 * @returns {Promise} 查询结果
 */
async function query(sql, params = []) {
  try {
    const [results] = await pool.execute(sql, params);
    return results;
  } catch (error) {
    console.error('Database query error:', error);
    throw error;
  }
}

/**
 * 执行事务
 * @param {Function} callback - 事务回调函数
 * @returns {Promise} 事务结果
 */
async function transaction(callback) {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const result = await callback(connection);
    await connection.commit();
    return result;
  } catch (error) {
    await connection.rollback();
    console.error('Transaction error:', error);
    throw error;
  } finally {
    connection.release();
  }
}

/**
 * 获取用户ID（从上下文获取）
 * @param {Object} context - 云函数上下文
 * @returns {number} 用户ID
 */
function getUserId(context) {
  // 从云函数上下文中获取用户信息
  // 实际部署时，这里会从微信登录信息中获取openid，然后查询对应的user_id
  return context.userId || 1; // 默认返回1，实际应该根据openid查询
}

module.exports = {
  query,
  transaction,
  getUserId,
  pool
};
