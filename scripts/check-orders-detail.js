/**
 * 检查订单详情和统计
 */

const mysql = require('mysql2/promise');

const dbConfig = {
  host: 'sh-cynosdbmysql-grp-ltto3044.sql.tencentcdb.com',
  port: 29764,
  user: 'readonly',
  password: 'Ro19941020',
  database: 'dev-0gtpuq9p785f5498',
  charset: 'utf8mb4'
};

async function checkOrders() {
  let connection;
  try {
    connection = await mysql.createConnection(dbConfig);

    console.log('=== 所有订单 ===');
    const [orders] = await connection.query(`
      SELECT o.id, o.meal_id, o.user_id, o.dish_id, d.name as dish_name, o.status, o.created_at
      FROM wte_orders o
      JOIN wte_dishes d ON o.dish_id = d.id
      ORDER BY o.created_at DESC
    `);
    console.log(`共 ${orders.length} 条订单记录`);
    console.log(orders);
    console.log('');

    console.log('=== 按 meal_id=1 统计订单 ===');
    const [stats] = await connection.query(`
      SELECT
        d.id as dish_id,
        d.name as dish_name,
        COUNT(o.id) as order_count
      FROM wte_dishes d
      LEFT JOIN wte_orders o ON d.id = o.dish_id AND o.meal_id = 1 AND o.status = 1
      WHERE d.kitchen_id = 1 AND d.status = 1
      GROUP BY d.id, d.name
    `);
    console.log(stats);
    console.log('');

    console.log('=== 查询每个菜品的点选用户 ===');
    const [orderers] = await connection.query(`
      SELECT
        o.dish_id,
        d.name as dish_name,
        u.nickname
      FROM wte_orders o
      JOIN wte_dishes d ON o.dish_id = d.id
      JOIN wte_users u ON o.user_id = u.id
      WHERE o.meal_id = 1 AND o.status = 1
      ORDER BY o.dish_id
    `);
    console.log(orderers);

  } catch (error) {
    console.error('查询失败:', error.message);
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

checkOrders();
