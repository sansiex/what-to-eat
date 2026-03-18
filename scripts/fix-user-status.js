/**
 * 修复用户状态问题
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

async function fixUserStatus() {
  const pool = mysql.createPool(dbConfig);

  try {
    console.log('检查所有用户状态...');
    const [users] = await pool.query(
      'SELECT id, openid, nickname, status FROM wte_users ORDER BY id'
    );
    console.table(users);

    // 检查是否有重复 openid
    console.log('\n检查重复 openid...');
    const [duplicates] = await pool.query(
      `SELECT openid, COUNT(*) as count 
       FROM wte_users 
       GROUP BY openid 
       HAVING count > 1`
    );
    console.log('重复 openid:', duplicates);

    // 确保用户ID=5状态正常
    console.log('\n确保用户ID=5状态正常...');
    const [updateResult] = await pool.query(
      "UPDATE wte_users SET status = 1, openid = 'dev_local_sansi_fixed_id' WHERE id = 5"
    );
    console.log('更新结果:', updateResult);

    // 检查是否有其他用户使用相同的 openid
    console.log('\n检查是否有其他用户使用 dev_local_sansi_fixed_id...');
    const [sameOpenid] = await pool.query(
      "SELECT id, openid, nickname, status FROM wte_users WHERE openid = 'dev_local_sansi_fixed_id'"
    );
    console.table(sameOpenid);

    // 如果有其他用户使用相同的 openid，修改它们
    if (sameOpenid.length > 1) {
      console.log('发现多个用户使用相同的 openid，需要修复...');
      for (const user of sameOpenid) {
        if (user.id !== 5) {
          const newOpenid = `fixed_openid_${user.id}_${Date.now()}`;
          console.log(`修改用户ID=${user.id}的openid为: ${newOpenid}`);
          await pool.query(
            'UPDATE wte_users SET openid = ? WHERE id = ?',
            [newOpenid, user.id]
          );
        }
      }
    }

    console.log('\n修复完成！');
    const [finalUsers] = await pool.query(
      'SELECT id, openid, nickname, status FROM wte_users ORDER BY id'
    );
    console.table(finalUsers);

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await pool.end();
  }
}

fixUserStatus();
