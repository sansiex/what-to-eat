/**
 * 检查 getMyOrder 查询
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

async function checkMyOrder() {
  let connection;
  try {
    connection = await mysql.createConnection(dbConfig);

    const mealId = 1;
    const userId = 1;

    console.log('=== 查询用户订单 ===');
    console.log('mealId:', mealId, 'userId:', userId);

    // 模拟 getMyOrder 查询
    const [orders] = await connection.query(`
      SELECT
        o.id,
        o.dish_id,
        d.name as dish_name,
        o.created_at
      FROM wte_orders o
      INNER JOIN wte_dishes d ON o.dish_id = d.id
      WHERE o.meal_id = ? AND o.user_id = ? AND o.status = 1
      ORDER BY o.created_at DESC
    `, [mealId, userId]);

    console.log('查询结果:', orders);
    console.log('订单数量:', orders.length);

    if (orders.length > 0) {
      console.log('\n返回给前端的数据:');
      console.log({
        mealId,
        hasOrdered: true,
        orders: orders.map(order => ({
          dishId: order.dish_id,
          dishName: order.dish_name,
          createdAt: order.created_at
        }))
      });
    } else {
      console.log('\n返回给前端的数据:');
      console.log({
        mealId,
        hasOrdered: false,
        orders: []
      });
    }

  } catch (error) {
    console.error('查询失败:', error.message);
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

checkMyOrder();
