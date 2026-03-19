/**
 * 菜品管理云函数
 * 提供菜品的增删改查功能
 */

let db;
let response;
let loadError = null;

try {
  db = require('./utils/db');
  response = require('./utils/response');
  console.log('Utils loaded successfully');
} catch (err) {
  console.error('Failed to load utils:', err);
  loadError = err;
}

const { query, getUserId } = db || {};

const success = (data, message) => response?.success(data, message) || { code: 0, message, data, success: true };
const error = (message, code) => response?.error(message, code) || { code: code || -1, message, data: null, success: false };
const paramError = (message) => response?.paramError(message) || { code: 400, message, data: null, success: false };
const notFound = (message) => response?.notFound(message) || { code: 404, message, data: null, success: false };

/**
 * 检查用户是否为厨房成员（owner 或 admin），返回角色或 null
 */
async function checkKitchenMembership(kitchenId, userId) {
  const members = await query(
    'SELECT role FROM wte_kitchen_members WHERE kitchen_id = ? AND user_id = ? AND status = 1',
    [kitchenId, userId]
  );
  if (members.length > 0) return members[0].role;

  // Fallback: check direct ownership (pre-migration compatibility)
  const owned = await query(
    'SELECT id FROM wte_kitchens WHERE id = ? AND user_id = ? AND status = 1',
    [kitchenId, userId]
  );
  return owned.length > 0 ? 'owner' : null;
}

exports.main = async (event, context) => {
  if (loadError) {
    return {
      success: false,
      code: -1,
      message: 'Failed to load dependencies: ' + loadError.message,
      data: null
    };
  }

  const { action, data } = event;
  console.log('Dish function called:', { action, data });

  try {
    switch (action) {
      case 'create':
        return await createDish(data, context);
      case 'update':
        return await updateDish(data, context);
      case 'delete':
        return await deleteDish(data, context);
      case 'list':
        return await listDishes(data, context);
      case 'get':
        return await getDish(data, context);
      default:
        return paramError('未知的操作类型');
    }
  } catch (err) {
    console.error('Dish function error:', err);
    return error(err.message || '操作失败');
  }
};

async function createDish(data, context) {
  const { name, description, imageUrl, kitchenId } = data || {};

  if (!name || name.trim() === '') {
    return paramError('菜品名称不能为空');
  }

  const userId = await getUserId(data, context);
  const trimmedName = name.trim();
  const trimmedDesc = description ? description.trim() : null;
  const trimmedImageUrl = imageUrl ? imageUrl.trim() : null;

  let targetKitchenId = kitchenId;
  if (!targetKitchenId) {
    const defaultKitchen = await query(
      'SELECT id FROM wte_kitchens WHERE user_id = ? AND is_default = 1 AND status = 1',
      [userId]
    );
    if (defaultKitchen.length === 0) {
      const kitchenResult = await query(
        'INSERT INTO wte_kitchens (user_id, name, is_default, status) VALUES (?, ?, 1, 1)',
        [userId, '我的厨房']
      );
      targetKitchenId = parseInt(kitchenResult.insertId);
    } else {
      targetKitchenId = parseInt(defaultKitchen[0].id);
    }
  } else {
    targetKitchenId = parseInt(targetKitchenId);
  }

  // Check membership
  const role = await checkKitchenMembership(targetKitchenId, userId);
  if (!role) {
    return error('无权限操作该厨房');
  }

  const existingDishes = await query(
    'SELECT id FROM wte_dishes WHERE kitchen_id = ? AND name = ? AND status = 1',
    [targetKitchenId, trimmedName]
  );

  if (existingDishes.length > 0) {
    return error('该菜品名称已存在');
  }

  const result = await query(
    'INSERT INTO wte_dishes (user_id, kitchen_id, name, description, image_url) VALUES (?, ?, ?, ?, ?)',
    [userId, targetKitchenId, trimmedName, trimmedDesc, trimmedImageUrl]
  );

  const newDish = await query(
    'SELECT id, name, description, image_url, created_at FROM wte_dishes WHERE id = ?',
    [result.insertId]
  );

  return success(newDish[0], '菜品创建成功');
}

async function updateDish(data, context) {
  const { id, name, description, imageUrl } = data || {};

  if (!id) return paramError('菜品ID不能为空');
  if (!name || name.trim() === '') return paramError('菜品名称不能为空');

  const userId = await getUserId(data, context);
  const trimmedName = name.trim();
  const trimmedDesc = description ? description.trim() : null;
  const trimmedImageUrl = imageUrl ? imageUrl.trim() : null;

  const existingDish = await query(
    'SELECT id, kitchen_id FROM wte_dishes WHERE id = ? AND status = 1',
    [id]
  );
  if (existingDish.length === 0) return notFound('菜品不存在');

  const role = await checkKitchenMembership(existingDish[0].kitchen_id, userId);
  if (!role) return error('无权限操作该菜品');

  const duplicateCheck = await query(
    'SELECT id FROM wte_dishes WHERE kitchen_id = ? AND name = ? AND status = 1 AND id != ?',
    [existingDish[0].kitchen_id, trimmedName, id]
  );

  if (duplicateCheck.length > 0) {
    return error('该菜品名称已存在');
  }

  await query(
    'UPDATE wte_dishes SET name = ?, description = ?, image_url = ? WHERE id = ?',
    [trimmedName, trimmedDesc, trimmedImageUrl, id]
  );

  const updatedDish = await query(
    'SELECT id, name, description, image_url, created_at, updated_at FROM wte_dishes WHERE id = ?',
    [id]
  );

  return success(updatedDish[0], '菜品更新成功');
}

async function deleteDish(data, context) {
  const { id } = data || {};
  if (!id) return paramError('菜品ID不能为空');

  const userId = await getUserId(data, context);

  const existingDish = await query(
    'SELECT id, kitchen_id FROM wte_dishes WHERE id = ? AND status = 1',
    [id]
  );
  if (existingDish.length === 0) return notFound('菜品不存在');

  const role = await checkKitchenMembership(existingDish[0].kitchen_id, userId);
  if (!role) return error('无权限操作该菜品');

  await query('UPDATE wte_dishes SET status = 0 WHERE id = ?', [id]);

  return success(null, '菜品删除成功');
}

async function listDishes(data, context) {
  const { keyword, kitchenId, page = 1, pageSize = 100 } = data || {};
  const userId = await getUserId(data, context);

  let targetKitchenId = kitchenId;
  if (!targetKitchenId) {
    const defaultKitchen = await query(
      'SELECT id FROM wte_kitchens WHERE user_id = ? AND is_default = 1 AND status = 1',
      [userId]
    );
    if (defaultKitchen.length > 0) {
      targetKitchenId = defaultKitchen[0].id;
    } else {
      return success({ list: [], total: 0, page: parseInt(page), pageSize: parseInt(pageSize) });
    }
  }

  let sql = 'SELECT id, name, description, image_url, created_at FROM wte_dishes WHERE kitchen_id = ? AND status = 1';
  const params = [parseInt(targetKitchenId)];

  if (keyword && keyword.trim() !== '') {
    sql += ' AND name LIKE ?';
    params.push(`%${keyword.trim()}%`);
  }

  sql += ' ORDER BY created_at DESC';
  const offset = (parseInt(page) - 1) * parseInt(pageSize);
  sql += ' LIMIT ? OFFSET ?';
  params.push(parseInt(pageSize), offset);

  const dishes = await query(sql, params);

  let countSql = 'SELECT COUNT(*) as total FROM wte_dishes WHERE kitchen_id = ? AND status = 1';
  const countParams = [parseInt(targetKitchenId)];

  if (keyword && keyword.trim() !== '') {
    countSql += ' AND name LIKE ?';
    countParams.push(`%${keyword.trim()}%`);
  }

  const countResult = await query(countSql, countParams);

  return success({
    list: dishes,
    total: countResult[0].total,
    page: parseInt(page),
    pageSize: parseInt(pageSize)
  });
}

async function getDish(data, context) {
  const { id } = data || {};
  if (!id) return paramError('菜品ID不能为空');

  const dish = await query(
    'SELECT id, name, description, image_url, kitchen_id, created_at FROM wte_dishes WHERE id = ? AND status = 1',
    [id]
  );

  if (dish.length === 0) return notFound('菜品不存在');

  return success(dish[0]);
}
