/**
 * 调试菜品数据
 */

const mysql = require('mysql2/promise');

const dbConfig = {
  host: 'sh-cynosdbmysql-grp-ltto3044.sql.tencentcdb.com',
  port: 29764,
  user: 'readonly',
  password: 'ReadOnly8675309',
  database: 'dev-0gtpuq9p785f5498',
  timezone: '+08:00',
  charset: 'utf8mb4'
};

async function debugDishes() {
  const pool = mysql.createPool(dbConfig);

  try {
    // 查看所有菜品
    console.log('=== 所有菜品 ===');
    const [dishes] = await pool.query(
      `SELECT id, name, user_id, kitchen_id, status, created_at
       FROM wte_dishes
       WHERE status = 1
       ORDER BY id`
    );
    console.table(dishes);

    // 查看所有用户
    console.log('\n=== 所有用户 ===');
    const [users] = await pool.query(
      `SELECT id, openid, nickname, status, created_at
       FROM wte_users
       WHERE status = 1
       ORDER BY id`
    );
    console.table(users);

    // 查看所有厨房
    console.log('\n=== 所有厨房 ===');
    const [kitchens] = await pool.query(
      `SELECT id, name, user_id, is_default, status, created_at
       FROM wte_kitchens
       WHERE status = 1
       ORDER BY id`
    );
    console.table(kitchens);

    // 查看菜品和厨房的关联
    console.log('\n=== 菜品-用户-厨房关联 ===');
    const [relations] = await pool.query(
      `SELECT d.id as dish_id, d.name as dish_name, d.user_id as dish_user_id,
              d.kitchen_id as dish_kitchen_id, u.nickname as user_nickname,
              k.name as kitchen_name, k.user_id as kitchen_user_id
       FROM wte_dishes d
       LEFT JOIN wte_users u ON d.user_id = u.id
       LEFT JOIN wte_kitchens k ON d.kitchen_id = k.id
       WHERE d.status = 1
       ORDER BY d.id`
    );
    console.table(relations);

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await pool.end();
  }
}

debugDishes();
