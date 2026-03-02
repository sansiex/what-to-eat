/**
 * 数据库连接工具
 * 使用 mysql2/promise 连接 MySQL 数据库
 */

const mysql = require('mysql2/promise');

// 数据库配置 - 使用公网地址
const dbConfig = {
  host: process.env.DB_HOST || 'sh-cynosdbmysql-grp-ltto3044.sql.tencentcdb.com',
  port: parseInt(process.env.DB_PORT || '29764'),
  user: process.env.DB_USER || 'mpfunctions',
  password: process.env.DB_PASSWORD || 'Func8675309',
  database: process.env.DB_NAME || 'dev-0gtpuq9p785f5498',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  connectTimeout: 10000,
  enableKeepAlive: true,
  keepAliveInitialDelay: 10000
};

// 创建连接池
let pool;

try {
  pool = mysql.createPool(dbConfig);
  console.log('Database pool created successfully');
} catch (err) {
  console.error('Failed to create database pool:', err);
  throw err;
}

/**
 * 执行 SQL 查询
 * @param {string} sql - SQL 语句
 * @param {Array} params - 查询参数
 * @returns {Promise} 查询结果
 */
async function query(sql, params = []) {
  console.log('Executing query:', sql);
  console.log('With params:', params);

  try {
    // 使用 pool.query() 而不是 pool.execute() 来避免参数绑定问题
    const [rows] = await pool.query(sql, params);
    console.log('Query result rows:', rows ? rows.length : 0);
    return rows;
  } catch (err) {
    console.error('Query error:', err);
    console.error('Error code:', err.code);
    console.error('Error message:', err.message);
    throw err;
  }
}

/**
 * 获取用户ID（从上下文中）
 * @param {Object} context - 云函数上下文
 * @returns {number} 用户ID
 */
function getUserId(context) {
  // 从 HTTP 请求头中获取用户ID
  if (context && context.headers) {
    const userId = context.headers['x-user-id'] || context.headers['X-User-Id'];
    if (userId) {
      return parseInt(userId) || 1;
    }
  }

  // 从环境变量获取（用于测试）
  if (process.env.TEST_USER_ID) {
    return parseInt(process.env.TEST_USER_ID) || 1;
  }

  // 返回默认用户ID（开发测试用）
  return 1;
}

module.exports = {
  query,
  getUserId,
  pool
};
