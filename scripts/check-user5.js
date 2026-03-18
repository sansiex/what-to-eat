/**
 * 检查用户ID=5的信息
 */

const mysql = require('mysql2/promise');

const dbConfig = {
  host: 'sh-cynosdbmysql-grp-ltto3044.sql.tencentcdb.com',
  port: 29764,
  user: 'mpfunctions',
  password: 'Func8675309',
  database: 'dev-0gtpuq9p785f5498',
  timezone: '+08:00',
  charset: 'utf8mb4'
};

async function checkUser5() {
  const pool = mysql.createPool(dbConfig);

  try {
    console.log('=== 用户ID=5的信息 ===');
    const [users] = await pool.query(
      `SELECT id, openid, nickname, avatar_url, status, created_at, last_login_at
       FROM wte_users
       WHERE id = 5`
    );
    console.table(users);

    console.log('\n=== 所有用户的openid ===');
    const [allUsers] = await pool.query(
      `SELECT id, openid, nickname
       FROM wte_users
       ORDER BY id`
    );
    console.table(allUsers);

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await pool.end();
  }
}

checkUser5();
