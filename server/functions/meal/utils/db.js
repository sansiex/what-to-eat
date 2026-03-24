/**
 * 数据库连接工具
 * 使用腾讯云MySQL数据库
 */

const mysql = require('mysql2/promise');

function requiredEnv(name) {
  const v = process.env[name];
  if (v == null || String(v).trim() === '') {
    throw new Error(
      `[db] Missing required environment variable: ${name}. Configure DB_HOST, DB_PORT, DB_USER, DB_PASSWORD, DB_NAME for this cloud function.`
    );
  }
  return String(v).trim();
}

const port = parseInt(requiredEnv('DB_PORT'), 10);
if (!Number.isFinite(port) || port <= 0) {
  throw new Error('[db] DB_PORT must be a positive integer');
}

// 数据库配置仅从环境变量读取（勿在仓库中写死连接信息）
const dbConfig = {
  host: requiredEnv('DB_HOST'),
  port,
  user: requiredEnv('DB_USER'),
  password: requiredEnv('DB_PASSWORD'),
  database: requiredEnv('DB_NAME'),
  waitForConnections: true,
  connectionLimit: 3,
  queueLimit: 0,
  timezone: '+08:00',
  charset: 'utf8mb4',
  enableKeepAlive: true,
  keepAliveInitialDelay: 10000
};

// 创建连接池
const pool = mysql.createPool(dbConfig);

const RETRYABLE_CODES = ['ECONNRESET', 'ECONNREFUSED', 'ETIMEDOUT', 'PROTOCOL_CONNECTION_LOST'];

/**
 * 执行SQL查询（带自动重试）
 * @param {string} sql - SQL语句
 * @param {Array} params - 查询参数
 * @returns {Promise} 查询结果
 */
async function query(sql, params = []) {
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const [results] = await pool.query(sql, params);
      return results;
    } catch (error) {
      const shouldRetry = attempt < 2 && (
        RETRYABLE_CODES.includes(error.code) ||
        (error.message && error.message.includes('ECONNRESET'))
      );
      if (shouldRetry) {
        console.warn(`Database query failed (${error.code || error.message}), retrying...`);
        continue;
      }
      console.error('Database query error:', error);
      throw error;
    }
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
 * @param {Object} eventData - 事件数据（包含 _openid 和 _userInfo）
 * @param {Object} context - 云函数上下文
 * @returns {number} 用户ID
 */
async function getUserId(eventData, context) {
  // 从云函数上下文中获取用户信息
  // 支持多种调用方式：云函数调用、HTTP调用
  if (!eventData) {
    console.warn('EventData is undefined, using default userId 1');
    return 1;
  }

  // 优先从 context.userId 获取
  if (context && context.userId) {
    return context.userId;
  }

  // 从 eventData 中获取用户信息（通过 _openid）
  // 支持本地云函数调用和 HTTP 调用
  if (eventData._openid) {
    const openid = eventData._openid;
    console.log('getUserId: found openid:', openid);
    
    // 根据 openid 查询用户ID
    const [users] = await pool.query(
      'SELECT id, nickname FROM wte_users WHERE openid = ? AND status = 1',
      [openid]
    );
    if (users.length > 0) {
      console.log('getUserId: found existing user:', users[0].id, 'nickname:', users[0].nickname);
      return users[0].id;
    }
    
    // 如果用户不存在，创建新用户
    const userInfo = eventData._userInfo || {};
    const nickname = userInfo.nickName || '微信用户';
    const avatarUrl = userInfo.avatarUrl || '';
    console.log('getUserId: creating new user with nickname:', nickname);
    
    const [result] = await pool.query(
      'INSERT INTO wte_users (openid, nickname, avatar_url) VALUES (?, ?, ?)',
      [openid, nickname, avatarUrl]
    );
    console.log('getUserId: created new user with id:', result.insertId);
    return result.insertId;
  }

  // HTTP 调用时，从 eventData 中获取
  if (eventData.userId) {
    return eventData.userId;
  }

  // 默认返回1，实际应该根据openid查询
  console.warn('UserId not found in eventData, using default userId 1');
  return 1;
}

module.exports = {
  query,
  transaction,
  getUserId,
  pool
};
