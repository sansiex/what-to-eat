/**
 * 检查指定 openid 的用户
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

async function checkOpenid() {
  const pool = mysql.createPool(dbConfig);

  try {
    const openid = 'oYDpC3U81zfgCzVcbXOrIbCJZ1dQ';

    console.log('=== 查找 openid 对应的用户 ===');
    const [users] = await pool.query(
      'SELECT id, openid, nickname, status FROM wte_users WHERE openid = ?',
      [openid]
    );
    console.table(users);

    if (users.length > 0) {
      const userId = users[0].id;
      console.log(`\n=== 用户ID=${userId} 的厨房 ===`);
      const [kitchens] = await pool.query(
        'SELECT id, name, user_id, is_default, status FROM wte_kitchens WHERE user_id = ? AND status = 1',
        [userId]
      );
      console.table(kitchens);
    }

    console.log('\n=== 所有用户的 openid ===');
    const [allUsers] = await pool.query(
      'SELECT id, openid, nickname, status FROM wte_users ORDER BY id'
    );
    console.table(allUsers);

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await pool.end();
  }
}

checkOpenid();
