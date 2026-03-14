/**
 * 菜单管理云函数
 * 提供菜单的增删改查功能
 */

const { query, transaction, getUserId } = require('./utils/db');
const { success, error, paramError, notFound } = require('./utils/response');

/**
 * 主入口函数
 * @param {Object} event - 请求参数
 * @param {Object} context - 云函数上下文
 * @returns {Object} 响应结果
 */
exports.main = async (event, context) => {
  const { action, data } = event;
  
  try {
    switch (action) {
      case 'list':
        return await listMenus(data, context);
      case 'create':
        return await createMenu(data, context);
      case 'update':
        return await updateMenu(data, context);
      case 'delete':
        return await deleteMenu(data, context);
      case 'get':
        return await getMenu(data, context);
      default:
        return paramError('未知的操作类型');
    }
  } catch (err) {
    console.error('Menu function error:', err);
    return error(err.message || '操作失败');
  }
};

/**
 * 获取菜单列表
 * @param {Object} data - 查询参数
 * @param {Object} context - 上下文
 * @returns {Object} 菜单列表
 */
async function listMenus(data, context) {
  const { kitchenId } = data || {}

  if (!kitchenId) {
    return paramError('厨房ID不能为空')
  }

  // 获取指定厨房的所有菜单（未删除的）
  const menus = await query(
    `SELECT
       m.id,
       m.name,
       m.created_at,
       m.updated_at
     FROM wte_menus m
     WHERE m.kitchen_id = ? AND m.status = 1
     ORDER BY m.updated_at DESC`,
    [kitchenId]
  );
  
  // 获取每个菜单的菜品
  for (const menu of menus) {
    const dishes = await query(
      `SELECT 
         d.id,
         d.name,
         d.description
       FROM wte_menu_dishes md
       INNER JOIN wte_dishes d ON md.dish_id = d.id
       WHERE md.menu_id = ? AND md.status = 1 AND d.status = 1
       ORDER BY d.name ASC`,
      [menu.id]
    );
    menu.dishes = dishes;
  }
  
  return success({
    list: menus.map(menu => ({
      id: menu.id,
      name: menu.name,
      dishes: menu.dishes,
      createdAt: menu.created_at,
      updatedAt: menu.updated_at
    }))
  });
}

/**
 * 创建菜单
 * @param {Object} data - 菜单数据
 * @param {Object} context - 上下文
 * @returns {Object} 创建结果
 */
async function createMenu(data, context) {
  const { name, dishIds, kitchenId } = data || {};

  if (!kitchenId) {
    return paramError('厨房ID不能为空');
  }

  if (!name || name.trim() === '') {
    return paramError('菜单名称不能为空');
  }

  if (!dishIds || !Array.isArray(dishIds) || dishIds.length === 0) {
    return paramError('请至少选择一个菜品');
  }

  const userId = await getUserId(context);

  return await transaction(async (connection) => {
    // 创建菜单
    const [result] = await connection.execute(
      'INSERT INTO wte_menus (kitchen_id, user_id, name) VALUES (?, ?, ?)',
      [kitchenId, userId, name.trim()]
    );
    
    const menuId = result.insertId;
    
    // 添加菜单菜品关联
    for (const dishId of dishIds) {
      await connection.execute(
        'INSERT INTO wte_menu_dishes (menu_id, dish_id) VALUES (?, ?)',
        [menuId, dishId]
      );
    }
    
    // 返回菜单信息
    const [menu] = await connection.execute(
      `SELECT 
         m.id,
         m.name,
         m.created_at
       FROM wte_menus m
       WHERE m.id = ?`,
      [menuId]
    );
    
    return success({
      id: menu[0].id,
      name: menu[0].name,
      createdAt: menu[0].created_at
    }, '创建成功');
  });
}

/**
 * 更新菜单
 * @param {Object} data - 更新数据
 * @param {Object} context - 上下文
 * @returns {Object} 更新结果
 */
async function updateMenu(data, context) {
  const { id, name, dishIds } = data || {};
  
  if (!id) {
    return paramError('菜单ID不能为空');
  }
  
  if (!name || name.trim() === '') {
    return paramError('菜单名称不能为空');
  }
  
  if (!dishIds || !Array.isArray(dishIds) || dishIds.length === 0) {
    return paramError('请至少选择一个菜品');
  }
  
  const userId = await getUserId(context);
  
  // 检查菜单是否存在且属于当前用户
  const menu = await query(
    'SELECT id FROM wte_menus WHERE id = ? AND user_id = ? AND status = 1',
    [id, userId]
  );
  
  if (menu.length === 0) {
    return notFound('菜单不存在');
  }
  
  return await transaction(async (connection) => {
    // 更新菜单名称
    await connection.query(
      'UPDATE wte_menus SET name = ?, updated_at = NOW() WHERE id = ?',
      [name.trim(), id]
    );
    
    // 删除原有的菜品关联
    await connection.query(
      'UPDATE wte_menu_dishes SET status = 0 WHERE menu_id = ?',
      [id]
    );
    
    // 添加新的菜品关联（使用 INSERT ... ON DUPLICATE KEY UPDATE 处理重复）
    for (const dishId of dishIds) {
      await connection.query(
        `INSERT INTO wte_menu_dishes (menu_id, dish_id, status) VALUES (?, ?, 1)
         ON DUPLICATE KEY UPDATE status = 1`,
        [id, dishId]
      );
    }
    
    return success(null, '更新成功');
  });
}

/**
 * 删除菜单（软删除）
 * @param {Object} data - 删除数据
 * @param {Object} context - 上下文
 * @returns {Object} 删除结果
 */
async function deleteMenu(data, context) {
  const { id } = data || {};
  
  if (!id) {
    return paramError('菜单ID不能为空');
  }
  
  const userId = await getUserId(context);
  
  // 检查菜单是否存在且属于当前用户
  const menu = await query(
    'SELECT id FROM wte_menus WHERE id = ? AND user_id = ? AND status = 1',
    [id, userId]
  );
  
  if (menu.length === 0) {
    return notFound('菜单不存在');
  }
  
  // 软删除菜单
  await query(
    'UPDATE wte_menus SET status = 0, updated_at = NOW() WHERE id = ?',
    [id]
  );
  
  // 软删除关联的菜品
  await query(
    'UPDATE wte_menu_dishes SET status = 0 WHERE menu_id = ?',
    [id]
  );
  
  return success(null, '删除成功');
}

/**
 * 获取单个菜单
 * @param {Object} data - 查询参数
 * @param {Object} context - 上下文
 * @returns {Object} 菜单详情
 */
async function getMenu(data, context) {
  const { id } = data || {};
  
  if (!id) {
    return paramError('菜单ID不能为空');
  }
  
  const userId = await getUserId(context);
  
  // 获取菜单基本信息
  const [menu] = await query(
    `SELECT 
       m.id,
       m.name,
       m.created_at,
       m.updated_at
     FROM wte_menus m
     WHERE m.id = ? AND m.user_id = ? AND m.status = 1`,
    [id, userId]
  );
  
  if (!menu || menu.length === 0) {
    return notFound('菜单不存在');
  }
  
  // 获取菜单的菜品
  const dishes = await query(
    `SELECT 
       d.id,
       d.name,
       d.description
     FROM wte_menu_dishes md
     INNER JOIN wte_dishes d ON md.dish_id = d.id
     WHERE md.menu_id = ? AND md.status = 1 AND d.status = 1
     ORDER BY d.name ASC`,
    [id]
  );
  
  return success({
    id: menu[0].id,
    name: menu[0].name,
    dishes: dishes,
    createdAt: menu[0].created_at,
    updatedAt: menu[0].updated_at
  });
}
