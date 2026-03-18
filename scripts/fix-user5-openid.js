/**
 * 修复用户ID=5的openid，避免与其他用户冲突
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

async function fixUser5Openid() {
  const pool = mysql.createPool(dbConfig);

  try {
    // 生成新的唯一 openid
    const newOpenid = `mock_openid_fixed_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    console.log('正在修复用户ID=5的openid...');
    console.log('新的openid:', newOpenid);

    // 更新用户ID=5的openid
    const [result] = await pool.query(
      'UPDATE wte_users SET openid = ? WHERE id = 5',
      [newOpenid]
    );

    console.log('更新结果:', result);

    // 验证更新
    const [users] = await pool.query(
      'SELECT id, openid, nickname FROM wte_users WHERE id = 5'
    );
    console.log('更新后的用户信息:', users[0]);

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await pool.end();
  }
}

fixUser5Openid();
