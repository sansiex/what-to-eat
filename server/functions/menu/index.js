/**
 * 菜单管理云函数
 * 提供菜单的增删改查功能
 */

const { query, transaction, getUserId } = require('./utils/db');
const { success, error, paramError, notFound } = require('./utils/response');

/**
 * 检查用户是否为厨房成员（owner 或 admin），返回角色或 null
 */
async function checkKitchenMembership(kitchenId, userId) {
  const members = await query(
    'SELECT role FROM wte_kitchen_members WHERE kitchen_id = ? AND user_id = ? AND status = 1',
    [kitchenId, userId]
  );
  if (members.length > 0) return members[0].role;

  const owned = await query(
    'SELECT id FROM wte_kitchens WHERE id = ? AND user_id = ? AND status = 1',
    [kitchenId, userId]
  );
  return owned.length > 0 ? 'owner' : null;
}

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

async function listMenus(data, context) {
  const { kitchenId } = data || {}
  const userId = await getUserId(data, context);

  if (!kitchenId) {
    return paramError('厨房ID不能为空')
  }

  // Check membership instead of ownership
  const role = await checkKitchenMembership(kitchenId, userId);
  if (!role) {
    return notFound('厨房不存在或无权限访问');
  }

  const menus = await query(
    `SELECT m.id, m.name, m.created_at, m.updated_at
     FROM wte_menus m
     WHERE m.kitchen_id = ? AND m.status = 1
     ORDER BY m.updated_at DESC`,
    [kitchenId]
  );
  
  for (const menu of menus) {
    const dishes = await query(
      `SELECT d.id, d.name, d.description, d.image_url as imageUrl
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

async function createMenu(data, context) {
  const { name, dishIds, kitchenId } = data || {};

  if (!kitchenId) return paramError('厨房ID不能为空');
  if (!name || name.trim() === '') return paramError('菜单名称不能为空');
  if (!dishIds || !Array.isArray(dishIds) || dishIds.length === 0) return paramError('请至少选择一个菜品');

  const userId = await getUserId(data, context);

  const role = await checkKitchenMembership(kitchenId, userId);
  if (!role) return error('无权限操作该厨房');

  const duplicateCheck = await query(
    'SELECT id FROM wte_menus WHERE kitchen_id = ? AND name = ? AND status = 1',
    [kitchenId, name.trim()]
  );
  if (duplicateCheck.length > 0) {
    return error('该菜单名称已存在');
  }

  return await transaction(async (connection) => {
    const [result] = await connection.query(
      'INSERT INTO wte_menus (kitchen_id, user_id, name) VALUES (?, ?, ?)',
      [kitchenId, userId, name.trim()]
    );
    
    const menuId = result.insertId;
    
    for (const dishId of dishIds) {
      await connection.query(
        'INSERT INTO wte_menu_dishes (menu_id, dish_id) VALUES (?, ?)',
        [menuId, dishId]
      );
    }
    
    const [menu] = await connection.query(
      'SELECT m.id, m.name, m.created_at FROM wte_menus m WHERE m.id = ?',
      [menuId]
    );
    
    return success({
      id: menu[0].id,
      name: menu[0].name,
      createdAt: menu[0].created_at
    }, '创建成功');
  });
}

async function updateMenu(data, context) {
  const { id, name, dishIds } = data || {};
  
  if (!id) return paramError('菜单ID不能为空');
  if (!name || name.trim() === '') return paramError('菜单名称不能为空');
  if (!dishIds || !Array.isArray(dishIds) || dishIds.length === 0) return paramError('请至少选择一个菜品');
  
  const userId = await getUserId(data, context);
  
  // Get menu's kitchen_id and check membership
  const menu = await query(
    'SELECT id, kitchen_id FROM wte_menus WHERE id = ? AND status = 1',
    [id]
  );
  if (menu.length === 0) return notFound('菜单不存在');

  const role = await checkKitchenMembership(menu[0].kitchen_id, userId);
  if (!role) return error('无权限操作该菜单');

  const duplicateCheck = await query(
    'SELECT id FROM wte_menus WHERE kitchen_id = ? AND name = ? AND status = 1 AND id != ?',
    [menu[0].kitchen_id, name.trim(), id]
  );
  if (duplicateCheck.length > 0) {
    return error('该菜单名称已存在');
  }
  
  return await transaction(async (connection) => {
    await connection.query(
      'UPDATE wte_menus SET name = ?, updated_at = NOW() WHERE id = ?',
      [name.trim(), id]
    );
    
    await connection.query(
      'UPDATE wte_menu_dishes SET status = 0 WHERE menu_id = ?',
      [id]
    );
    
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

async function deleteMenu(data, context) {
  const { id } = data || {};
  if (!id) return paramError('菜单ID不能为空');
  
  const userId = await getUserId(data, context);
  
  const menu = await query(
    'SELECT id, kitchen_id FROM wte_menus WHERE id = ? AND status = 1',
    [id]
  );
  if (menu.length === 0) return notFound('菜单不存在');

  const role = await checkKitchenMembership(menu[0].kitchen_id, userId);
  if (!role) return error('无权限操作该菜单');
  
  await query('UPDATE wte_menus SET status = 0, updated_at = NOW() WHERE id = ?', [id]);
  await query('UPDATE wte_menu_dishes SET status = 0 WHERE menu_id = ?', [id]);
  
  return success(null, '删除成功');
}

async function getMenu(data, context) {
  const { id } = data || {};
  if (!id) return paramError('菜单ID不能为空');
  
  const userId = await getUserId(data, context);
  
  const menuRows = await query(
    'SELECT m.id, m.name, m.kitchen_id, m.created_at, m.updated_at FROM wte_menus m WHERE m.id = ? AND m.status = 1',
    [id]
  );
  
  if (menuRows.length === 0) return notFound('菜单不存在');
  const menu = menuRows[0];

  const role = await checkKitchenMembership(menu.kitchen_id, userId);
  if (!role) return error('无权限查看该菜单');
  
  const dishes = await query(
    `SELECT d.id, d.name, d.description, d.image_url as imageUrl
     FROM wte_menu_dishes md
     INNER JOIN wte_dishes d ON md.dish_id = d.id
     WHERE md.menu_id = ? AND md.status = 1 AND d.status = 1
     ORDER BY d.name ASC`,
    [id]
  );
  
  return success({
    id: menu.id,
    name: menu.name,
    dishes: dishes,
    createdAt: menu.created_at,
    updatedAt: menu.updated_at
  });
}
