/**
 * 将用户ID=14的数据迁移到用户ID=15
 * 因为用户ID=15使用的是真实的openid
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

async function migrateUser14To15() {
  const pool = mysql.createPool(dbConfig);

  try {
    console.log('开始迁移用户ID=14的数据到用户ID=15...');

    // 1. 更新用户ID=15的昵称
    console.log('\n1. 更新用户ID=15的昵称...');
    await pool.query(
      "UPDATE wte_users SET nickname = '三思' WHERE id = 15"
    );

    // 2. 将用户ID=14的厨房转移到用户ID=15
    console.log('\n2. 转移厨房...');
    await pool.query(
      'UPDATE wte_kitchens SET user_id = 15 WHERE user_id = 14'
    );

    // 3. 将用户ID=14的菜品转移到用户ID=15
    console.log('\n3. 转移菜品...');
    await pool.query(
      'UPDATE wte_dishes SET user_id = 15 WHERE user_id = 14'
    );

    // 4. 将用户ID=14的菜单转移到用户ID=15
    console.log('\n4. 转移菜单...');
    await pool.query(
      'UPDATE wte_menus SET user_id = 15 WHERE user_id = 14'
    );

    // 5. 将用户ID=14的点餐转移到用户ID=15
    console.log('\n5. 转移点餐...');
    await pool.query(
      'UPDATE wte_meals SET user_id = 15 WHERE user_id = 14'
    );

    // 6. 将用户ID=14的订单转移到用户ID=15
    console.log('\n6. 转移订单...');
    await pool.query(
      'UPDATE wte_orders SET user_id = 15 WHERE user_id = 14'
    );

    // 7. 删除用户ID=14
    console.log('\n7. 删除用户ID=14...');
    await pool.query(
      'UPDATE wte_users SET status = 0 WHERE id = 14'
    );

    console.log('\n迁移完成！');

    // 验证结果
    console.log('\n验证结果:');
    const [users] = await pool.query(
      'SELECT id, openid, nickname, status FROM wte_users WHERE status = 1 ORDER BY id'
    );
    console.table(users);

    const [kitchens] = await pool.query(
      'SELECT id, name, user_id FROM wte_kitchens WHERE user_id = 15'
    );
    console.log('\n用户ID=15的厨房:');
    console.table(kitchens);

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await pool.end();
  }
}

migrateUser14To15();
