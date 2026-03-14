/**
 * 数据库连接工具
 * 使用腾讯云MySQL数据库
 */

const mysql = require('mysql2/promise');

// 数据库配置 - 优先使用环境变量，否则使用默认配置
// 注意：使用公网地址访问 MySQL
const dbConfig = {
  host: process.env.DB_HOST || 'sh-cynosdbmysql-grp-ltto3044.sql.tencentcdb.com',
  port: parseInt(process.env.DB_PORT || '29764'),
  user: process.env.DB_USER || 'mpfunctions',
  password: process.env.DB_PASSWORD || 'Func8675309',
  database: process.env.DB_NAME || 'dev-0gtpuq9p785f5498',
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
    // 使用 query 而不是 execute，避免 prepared statement 问题
    const [results] = await pool.query(sql, params);
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
async function getUserId(context) {
  // 从云函数上下文中获取用户信息
  // 支持多种调用方式：云函数调用、HTTP调用
  if (!context) {
    console.warn('Context is undefined, using default userId 1');
    return 1;
  }

  // 优先从 context.userId 获取
  if (context.userId) {
    return context.userId;
  }

  // 从小程序云函数调用中获取用户信息（通过 data._openid）
  if (context.data && context.data._openid) {
    const openid = context.data._openid;
    // 根据 openid 查询用户ID
    const [users] = await pool.query(
      'SELECT id FROM wte_users WHERE openid = ? AND status = 1',
      [openid]
    );
    if (users.length > 0) {
      return users[0].id;
    }
    // 如果用户不存在，创建新用户
    const userInfo = context.data._userInfo || {};
    const nickname = userInfo.nickName || '微信用户';
    const avatarUrl = userInfo.avatarUrl || '';
    const [result] = await pool.query(
      'INSERT INTO wte_users (openid, nickname, avatar_url) VALUES (?, ?, ?)',
      [openid, nickname, avatarUrl]
    );
    return result.insertId;
  }

  // HTTP 调用时，从 context.data 中获取
  if (context.data && context.data.userId) {
    return context.data.userId;
  }

  // 默认返回1，实际应该根据openid查询
  console.warn('UserId not found in context, using default userId 1');
  return 1;
}

module.exports = {
  query,
  transaction,
  getUserId,
  pool
};
