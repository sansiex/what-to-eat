/**
 * 检查订单详情
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

    // 查看订单表结构
    console.log('=== 订单表结构 (wte_orders) ===');
    const [orderColumns] = await connection.query('DESCRIBE wte_orders');
    console.log(orderColumns);
    console.log('');

    // 查看订单详情（关联菜品名称）
    console.log('=== 订单详情（关联菜品） ===');
    const [orderDetails] = await connection.query(`
      SELECT 
        o.id as order_id,
        o.meal_id,
        o.user_id,
        o.dish_id,
        d.name as dish_name,
        o.status,
        o.created_at
      FROM wte_orders o
      JOIN wte_dishes d ON o.dish_id = d.id
      WHERE o.meal_id = 1 AND o.status = 1
    `);
    console.log(`共 ${orderDetails.length} 条订单记录`);
    console.log(orderDetails);
    console.log('');

    // 统计每个菜品的订单数量
    console.log('=== 菜品订单统计 ===');
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

  } catch (error) {
    console.error('查询失败:', error.message);
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

checkOrders();
