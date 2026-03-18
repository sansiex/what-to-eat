/**
 * 检查厨房数据
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

async function checkKitchens() {
  const pool = mysql.createPool(dbConfig);

  try {
    console.log('=== 所有厨房 ===');
    const [kitchens] = await pool.query(
      `SELECT id, name, user_id, is_default, status, created_at
       FROM wte_kitchens
       ORDER BY user_id, id`
    );
    console.table(kitchens);

    console.log('\n=== 用户ID=5的厨房 ===');
    const [user5Kitchens] = await pool.query(
      `SELECT id, name, user_id, is_default, status, created_at
       FROM wte_kitchens
       WHERE user_id = 5 AND status = 1`
    );
    console.table(user5Kitchens);

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await pool.end();
  }
}

checkKitchens();
