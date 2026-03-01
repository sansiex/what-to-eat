/**
 * 数据库检查脚本
 * 用于查询数据库中的数据状态
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

async function checkDatabase() {
  let connection;
  try {
    console.log('正在连接数据库...');
    connection = await mysql.createConnection(dbConfig);
    console.log('数据库连接成功！\n');

    // 查看所有表
    console.log('=== 数据库表 ===');
    const [tables] = await connection.query('SHOW TABLES');
    console.log(tables);
    console.log('');

    // 查看菜品数据
    console.log('=== 菜品数据 (wte_dishes) ===');
    const [dishes] = await connection.query('SELECT * FROM wte_dishes WHERE status = 1');
    console.log(`共 ${dishes.length} 条记录`);
    console.log(dishes);
    console.log('');

    // 查看厨房数据
    console.log('=== 厨房数据 (wte_kitchens) ===');
    const [kitchens] = await connection.query('SELECT * FROM wte_kitchens');
    console.log(`共 ${kitchens.length} 条记录`);
    console.log(kitchens);
    console.log('');

    // 查看点餐数据
    console.log('=== 点餐数据 (wte_meals) ===');
    const [meals] = await connection.query('SELECT * FROM wte_meals WHERE status = 1');
    console.log(`共 ${meals.length} 条记录`);
    console.log(meals);
    console.log('');

    // 查看订单数据
    console.log('=== 订单数据 (wte_orders) ===');
    const [orders] = await connection.query('SELECT * FROM wte_orders');
    console.log(`共 ${orders.length} 条记录`);
    console.log(orders);
    console.log('');

    // 查看订单菜品关联
    console.log('=== 订单菜品关联 (wte_order_dishes) ===');
    const [orderDishes] = await connection.query('SELECT * FROM wte_order_dishes');
    console.log(`共 ${orderDishes.length} 条记录`);
    console.log(orderDishes);
    console.log('');

    // 查看用户数据
    console.log('=== 用户数据 (wte_users) ===');
    const [users] = await connection.query('SELECT * FROM wte_users');
    console.log(`共 ${users.length} 条记录`);
    console.log(users);
    console.log('');

  } catch (error) {
    console.error('数据库查询失败:', error.message);
  } finally {
    if (connection) {
      await connection.end();
      console.log('\n数据库连接已关闭');
    }
  }
}

checkDatabase();
