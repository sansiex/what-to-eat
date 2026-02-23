/**
 * 菜品管理云函数
 * 提供菜品的增删改查功能
 */

const { query, transaction, getUserId } = require('../utils/db');
const { success, error, paramError, notFound } = require('../utils/response');

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

/**
 * 创建菜品
 * @param {Object} data - 菜品数据
 * @param {Object} context - 上下文
 * @returns {Object} 创建结果
 */
async function createDish(data, context) {
  const { name, description, kitchenId } = data || {};
  
  if (!name || name.trim() === '') {
    return paramError('菜品名称不能为空');
  }
  
  const userId = getUserId(context);
  const trimmedName = name.trim();
  const trimmedDesc = description ? description.trim() : null;
  
  // 如果没有提供kitchenId，获取用户的默认厨房
  let targetKitchenId = kitchenId;
  if (!targetKitchenId) {
    const defaultKitchen = await query(
      'SELECT id FROM wte_kitchens WHERE user_id = ? AND is_default = 1 AND status = 1',
      [userId]
    );
    if (defaultKitchen.length === 0) {
      return error('未找到默认厨房');
    }
    targetKitchenId = defaultKitchen[0].id;
  }
  
  // 检查是否已存在同名菜品
  const existingDishes = await query(
    'SELECT id FROM wte_dishes WHERE user_id = ? AND kitchen_id = ? AND name = ? AND status = 1',
    [userId, targetKitchenId, trimmedName]
  );
  
  if (existingDishes.length > 0) {
    return error('该菜品名称已存在');
  }
  
  // 插入新菜品
  const result = await query(
    'INSERT INTO wte_dishes (user_id, kitchen_id, name, description) VALUES (?, ?, ?, ?)',
    [userId, targetKitchenId, trimmedName, trimmedDesc]
  );
  
  const newDish = await query(
    'SELECT id, name, description, created_at FROM wte_dishes WHERE id = ?',
    [result.insertId]
  );
  
  return success(newDish[0], '菜品创建成功');
}

/**
 * 更新菜品
 * @param {Object} data - 更新数据
 * @param {Object} context - 上下文
 * @returns {Object} 更新结果
 */
async function updateDish(data, context) {
  const { id, name, description } = data || {};
  
  if (!id) {
    return paramError('菜品ID不能为空');
  }
  
  if (!name || name.trim() === '') {
    return paramError('菜品名称不能为空');
  }
  
  const userId = getUserId(context);
  const trimmedName = name.trim();
  const trimmedDesc = description ? description.trim() : null;
  
  // 检查菜品是否存在且属于当前用户
  const existingDish = await query(
    'SELECT id FROM wte_dishes WHERE id = ? AND user_id = ? AND status = 1',
    [id, userId]
  );
  
  if (existingDish.length === 0) {
    return notFound('菜品不存在');
  }
  
  // 获取菜品的kitchen_id
  const dishInfo = await query(
    'SELECT kitchen_id FROM wte_dishes WHERE id = ? AND user_id = ? AND status = 1',
    [id, userId]
  );
  
  if (dishInfo.length === 0) {
    return notFound('菜品不存在');
  }
  
  // 检查新名称是否与其他菜品重复
  const duplicateCheck = await query(
    'SELECT id FROM wte_dishes WHERE user_id = ? AND kitchen_id = ? AND name = ? AND status = 1 AND id != ?',
    [userId, dishInfo[0].kitchen_id, trimmedName, id]
  );
  
  if (duplicateCheck.length > 0) {
    return error('该菜品名称已存在');
  }
  
  // 更新菜品
  await query(
    'UPDATE wte_dishes SET name = ?, description = ? WHERE id = ?',
    [trimmedName, trimmedDesc, id]
  );
  
  const updatedDish = await query(
    'SELECT id, name, description, created_at, updated_at FROM wte_dishes WHERE id = ?',
    [id]
  );
  
  return success(updatedDish[0], '菜品更新成功');
}

/**
 * 删除菜品（软删除）
 * @param {Object} data - 删除数据
 * @param {Object} context - 上下文
 * @returns {Object} 删除结果
 */
async function deleteDish(data, context) {
  const { id } = data || {};
  
  if (!id) {
    return paramError('菜品ID不能为空');
  }
  
  const userId = getUserId(context);
  
  // 检查菜品是否存在且属于当前用户
  const existingDish = await query(
    'SELECT id FROM wte_dishes WHERE id = ? AND user_id = ? AND status = 1',
    [id, userId]
  );
  
  if (existingDish.length === 0) {
    return notFound('菜品不存在');
  }
  
  // 软删除
  await query(
    'UPDATE wte_dishes SET status = 0 WHERE id = ?',
    [id]
  );
  
  return success(null, '菜品删除成功');
}

/**
 * 获取菜品列表
 * @param {Object} data - 查询参数
 * @param {Object} context - 上下文
 * @returns {Object} 菜品列表
 */
async function listDishes(data, context) {
  const { keyword, kitchenId, page = 1, pageSize = 100 } = data || {};
  const userId = getUserId(context);
  
  // 如果没有提供kitchenId，获取用户的默认厨房
  let targetKitchenId = kitchenId;
  if (!targetKitchenId) {
    const defaultKitchen = await query(
      'SELECT id FROM wte_kitchens WHERE user_id = ? AND is_default = 1 AND status = 1',
      [userId]
    );
    if (defaultKitchen.length === 0) {
      return error('未找到默认厨房');
    }
    targetKitchenId = defaultKitchen[0].id;
  }
  
  let sql = 'SELECT id, name, description, created_at FROM wte_dishes WHERE user_id = ? AND kitchen_id = ? AND status = 1';
  const params = [userId, targetKitchenId];
  
  if (keyword && keyword.trim() !== '') {
    sql += ' AND name LIKE ?';
    params.push(`%${keyword.trim()}%`);
  }
  
  sql += ' ORDER BY created_at DESC';
  
  // 分页
  const offset = (page - 1) * pageSize;
  sql += ' LIMIT ? OFFSET ?';
  params.push(parseInt(pageSize), offset);
  
  const dishes = await query(sql, params);
  
  // 获取总数
  let countSql = 'SELECT COUNT(*) as total FROM wte_dishes WHERE user_id = ? AND kitchen_id = ? AND status = 1';
  const countParams = [userId, targetKitchenId];
  
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

/**
 * 获取单个菜品详情
 * @param {Object} data - 查询参数
 * @param {Object} context - 上下文
 * @returns {Object} 菜品详情
 */
async function getDish(data, context) {
  const { id } = data || {};
  
  if (!id) {
    return paramError('菜品ID不能为空');
  }
  
  const userId = getUserId(context);
  
  const dish = await query(
    'SELECT id, name, description, created_at FROM wte_dishes WHERE id = ? AND user_id = ? AND status = 1',
    [id, userId]
  );
  
  if (dish.length === 0) {
    return notFound('菜品不存在');
  }
  
  return success(dish[0]);
}
