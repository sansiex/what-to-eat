/**
 * 数据库连接工具（与其它云函数 utils/db.js 保持一致）
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

const pool = mysql.createPool(dbConfig);

const RETRYABLE_CODES = ['ECONNRESET', 'ECONNREFUSED', 'ETIMEDOUT', 'PROTOCOL_CONNECTION_LOST'];

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

module.exports = {
  query,
  transaction,
  pool
};
