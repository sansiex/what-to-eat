/**
 * 合并重复用户到用户ID=5
 * 删除临时创建的重复用户（ID 6, 7）
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

async function mergeDuplicateUsers() {
  const pool = mysql.createPool(dbConfig);

  try {
    // 目标用户ID（三思）
    const targetUserId = 5;
    // 需要删除的重复用户ID
    const duplicateUserIds = [6, 7];

    console.log('开始合并重复用户...');
    console.log('目标用户ID:', targetUserId);
    console.log('重复用户ID:', duplicateUserIds);

    // 1. 将重复用户的厨房转移到目标用户
    console.log('\n1. 转移厨房...');
    const [kitchenUpdate] = await pool.query(
      'UPDATE wte_kitchens SET user_id = ? WHERE user_id IN (?)',
      [targetUserId, duplicateUserIds]
    );
    console.log('厨房转移结果:', kitchenUpdate);

    // 2. 将重复用户的菜品转移到目标用户
    console.log('\n2. 转移菜品...');
    const [dishUpdate] = await pool.query(
      'UPDATE wte_dishes SET user_id = ? WHERE user_id IN (?)',
      [targetUserId, duplicateUserIds]
    );
    console.log('菜品转移结果:', dishUpdate);

    // 3. 将重复用户的菜单转移到目标用户
    console.log('\n3. 转移菜单...');
    const [menuUpdate] = await pool.query(
      'UPDATE wte_menus SET user_id = ? WHERE user_id IN (?)',
      [targetUserId, duplicateUserIds]
    );
    console.log('菜单转移结果:', menuUpdate);

    // 4. 将重复用户的点餐转移到目标用户
    console.log('\n4. 转移点餐...');
    const [mealUpdate] = await pool.query(
      'UPDATE wte_meals SET user_id = ? WHERE user_id IN (?)',
      [targetUserId, duplicateUserIds]
    );
    console.log('点餐转移结果:', mealUpdate);

    // 5. 将重复用户的订单转移到目标用户
    console.log('\n5. 转移订单...');
    const [orderUpdate] = await pool.query(
      'UPDATE wte_orders SET user_id = ? WHERE user_id IN (?)',
      [targetUserId, duplicateUserIds]
    );
    console.log('订单转移结果:', orderUpdate);

    // 6. 删除重复用户
    console.log('\n6. 删除重复用户...');
    for (const userId of duplicateUserIds) {
      const [deleteResult] = await pool.query(
        'UPDATE wte_users SET status = 0 WHERE id = ?',
        [userId]
      );
      console.log(`删除用户ID=${userId}:`, deleteResult);
    }

    // 7. 更新目标用户的openid为本地开发固定值
    console.log('\n7. 更新目标用户openid...');
    const [openidUpdate] = await pool.query(
      "UPDATE wte_users SET openid = 'dev_local_sansi_fixed_id' WHERE id = ?",
      [targetUserId]
    );
    console.log('openid更新结果:', openidUpdate);

    console.log('\n合并完成！');

    // 验证结果
    console.log('\n验证结果:');
    const [users] = await pool.query(
      'SELECT id, openid, nickname, status FROM wte_users WHERE status = 1 ORDER BY id'
    );
    console.table(users);

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await pool.end();
  }
}

mergeDuplicateUsers();
