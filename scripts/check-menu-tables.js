/**
 * 检查菜单相关表是否存在
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

async function checkMenuTables() {
  let connection;
  try {
    console.log('正在连接数据库...');
    connection = await mysql.createConnection(dbConfig);
    console.log('数据库连接成功！\n');

    // 查看所有表
    console.log('=== 数据库所有表 ===');
    const [tables] = await connection.query('SHOW TABLES');
    tables.forEach(table => {
      console.log(Object.values(table)[0]);
    });
    console.log('');

    // 检查 wte_menus 表
    console.log('=== 检查 wte_menus 表 ===');
    try {
      const [menus] = await connection.query('SELECT * FROM wte_menus LIMIT 5');
      console.log(`表存在，共 ${menus.length} 条记录`);
      console.log(menus);
    } catch (err) {
      console.log('表不存在或查询失败:', err.message);
    }
    console.log('');

    // 检查 wte_menu_dishes 表
    console.log('=== 检查 wte_menu_dishes 表 ===');
    try {
      const [menuDishes] = await connection.query('SELECT * FROM wte_menu_dishes LIMIT 5');
      console.log(`表存在，共 ${menuDishes.length} 条记录`);
      console.log(menuDishes);
    } catch (err) {
      console.log('表不存在或查询失败:', err.message);
    }
    console.log('');

  } catch (err) {
    console.error('数据库连接失败:', err.message);
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

checkMenuTables();
