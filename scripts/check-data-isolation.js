/**
 * 检查数据隔离情况
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

async function checkData() {
  const pool = mysql.createPool(dbConfig);

  try {
    // 查看所有用户
    console.log('=== 所有用户 ===');
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

    // 查看所有菜品
    console.log('\n=== 所有菜品 ===');
    const [dishes] = await pool.query(
      `SELECT id, name, user_id, kitchen_id, status, created_at
       FROM wte_dishes
       WHERE status = 1
       ORDER BY id`
    );
    console.table(dishes);

    // 查看所有菜单
    console.log('\n=== 所有菜单 ===');
    const [menus] = await pool.query(
      `SELECT id, name, user_id, kitchen_id, status, created_at
       FROM wte_menus
       WHERE status = 1
       ORDER BY id`
    );
    console.table(menus);

    // 查看数据关联
    console.log('\n=== 数据关联 ===');
    const [relations] = await pool.query(
      `SELECT 
        u.id as user_id, u.nickname,
        k.id as kitchen_id, k.name as kitchen_name,
        COUNT(DISTINCT d.id) as dish_count,
        COUNT(DISTINCT m.id) as menu_count
       FROM wte_users u
       LEFT JOIN wte_kitchens k ON u.id = k.user_id AND k.status = 1
       LEFT JOIN wte_dishes d ON k.id = d.kitchen_id AND d.status = 1
       LEFT JOIN wte_menus m ON k.id = m.kitchen_id AND m.status = 1
       WHERE u.status = 1
       GROUP BY u.id, k.id`
    );
    console.table(relations);

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await pool.end();
  }
}

checkData();
