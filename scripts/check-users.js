/**
 * 检查数据库中的用户信息
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

async function checkUsers() {
  let connection;
  try {
    console.log('正在连接数据库...');
    connection = await mysql.createConnection(dbConfig);
    console.log('数据库连接成功！\n');

    // 查看所有用户
    console.log('=== 用户列表 (wte_users) ===');
    const [users] = await connection.query('SELECT id, openid, nickname, status FROM wte_users');
    console.log(`共 ${users.length} 条记录`);
    users.forEach(user => {
      console.log(`ID: ${user.id}, OpenID: ${user.openid}, 昵称: ${user.nickname}, 状态: ${user.status}`);
    });
    console.log('');

    // 查看订单
    console.log('=== 订单列表 (wte_orders) ===');
    const [orders] = await connection.query('SELECT id, meal_id, user_id, dish_id, status FROM wte_orders WHERE status = 1 LIMIT 10');
    console.log(`共 ${orders.length} 条记录`);
    orders.forEach(order => {
      console.log(`ID: ${order.id}, 点餐ID: ${order.meal_id}, 用户ID: ${order.user_id}, 菜品ID: ${order.dish_id}`);
    });

  } catch (err) {
    console.error('数据库连接失败:', err.message);
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

checkUsers();
