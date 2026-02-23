/**
 * 点餐管理云函数
 * 提供点餐活动的增删改查、收单等功能
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
        return await createMeal(data, context);
      case 'update':
        return await updateMeal(data, context);
      case 'delete':
        return await deleteMeal(data, context);
      case 'list':
        return await listMeals(data, context);
      case 'get':
        return await getMeal(data, context);
      case 'close':
        return await closeMeal(data, context);
      default:
        return paramError('未知的操作类型');
    }
  } catch (err) {
    console.error('Meal function error:', err);
    return error(err.message || '操作失败');
  }
};

/**
 * 创建点餐活动
 * @param {Object} data - 点餐数据
 * @param {Object} context - 上下文
 * @returns {Object} 创建结果
 */
async function createMeal(data, context) {
  const { name, dishIds, kitchenId } = data || {};
  
  if (!name || name.trim() === '') {
    return paramError('点餐名称不能为空');
  }
  
  if (!dishIds || !Array.isArray(dishIds) || dishIds.length === 0) {
    return paramError('请至少选择一个菜品');
  }
  
  const userId = getUserId(context);
  const trimmedName = name.trim();
  
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
  
  return await transaction(async (connection) => {
    // 创建点餐活动
    const [mealResult] = await connection.execute(
      'INSERT INTO wte_meals (user_id, kitchen_id, name) VALUES (?, ?, ?)',
      [userId, targetKitchenId, trimmedName]
    );
    
    const mealId = mealResult.insertId;
    
    // 验证菜品是否都属于当前用户和厨房
    const placeholders = dishIds.map(() => '?').join(',');
    const [validDishes] = await connection.execute(
      `SELECT id FROM wte_dishes WHERE id IN (${placeholders}) AND user_id = ? AND kitchen_id = ? AND status = 1`,
      [...dishIds, userId, targetKitchenId]
    );
    
    if (validDishes.length !== dishIds.length) {
      throw new Error('部分菜品不存在或不属于当前用户');
    }
    
    // 关联菜品
    for (const dishId of dishIds) {
      await connection.execute(
        'INSERT INTO wte_meal_dishes (meal_id, dish_id) VALUES (?, ?)',
        [mealId, dishId]
      );
    }
    
    // 返回完整的点餐信息
    const [newMeal] = await connection.execute(
      `SELECT m.id, m.name, m.status, m.created_at,
        GROUP_CONCAT(d.id) as dish_ids,
        GROUP_CONCAT(d.name) as dish_names
      FROM wte_meals m
      LEFT JOIN wte_meal_dishes md ON m.id = md.meal_id AND md.status = 1
      LEFT JOIN wte_dishes d ON md.dish_id = d.id AND d.status = 1
      WHERE m.id = ?
      GROUP BY m.id`,
      [mealId]
    );
    
    return success({
      id: newMeal[0].id,
      name: newMeal[0].name,
      status: newMeal[0].status,
      createdAt: newMeal[0].created_at,
      dishes: parseDishes(newMeal[0].dish_ids, newMeal[0].dish_names)
    }, '点餐活动创建成功');
  });
}

/**
 * 更新点餐活动
 * @param {Object} data - 更新数据
 * @param {Object} context - 上下文
 * @returns {Object} 更新结果
 */
async function updateMeal(data, context) {
  const { id, name, dishIds } = data || {};
  
  if (!id) {
    return paramError('点餐ID不能为空');
  }
  
  if (!name || name.trim() === '') {
    return paramError('点餐名称不能为空');
  }
  
  if (!dishIds || !Array.isArray(dishIds) || dishIds.length === 0) {
    return paramError('请至少选择一个菜品');
  }
  
  const userId = getUserId(context);
  const trimmedName = name.trim();
  
  // 检查点餐是否存在且属于当前用户
  const existingMeal = await query(
    'SELECT id, status FROM wte_meals WHERE id = ? AND user_id = ?',
    [id, userId]
  );
  
  if (existingMeal.length === 0) {
    return notFound('点餐活动不存在');
  }
  
  if (existingMeal[0].status === 2) {
    return error('已收单的点餐活动不能修改');
  }
  
  return await transaction(async (connection) => {
    // 更新点餐名称
    await connection.execute(
      'UPDATE wte_meals SET name = ? WHERE id = ?',
      [trimmedName, id]
    );
    
    // 验证菜品
    const placeholders = dishIds.map(() => '?').join(',');
    const [validDishes] = await connection.execute(
      `SELECT id FROM wte_dishes WHERE id IN (${placeholders}) AND user_id = ? AND status = 1`,
      [...dishIds, userId]
    );
    
    if (validDishes.length !== dishIds.length) {
      throw new Error('部分菜品不存在或不属于当前用户');
    }
    
    // 删除旧的菜品关联
    await connection.execute(
      'UPDATE wte_meal_dishes SET status = 0 WHERE meal_id = ?',
      [id]
    );
    
    // 添加新的菜品关联
    for (const dishId of dishIds) {
      await connection.execute(
        'INSERT INTO wte_meal_dishes (meal_id, dish_id) VALUES (?, ?) ON DUPLICATE KEY UPDATE status = 1',
        [id, dishId]
      );
    }
    
    // 返回更新后的点餐信息
    const [updatedMeal] = await connection.execute(
      `SELECT m.id, m.name, m.status, m.created_at,
        GROUP_CONCAT(d.id) as dish_ids,
        GROUP_CONCAT(d.name) as dish_names
      FROM wte_meals m
      LEFT JOIN wte_meal_dishes md ON m.id = md.meal_id AND md.status = 1
      LEFT JOIN wte_dishes d ON md.dish_id = d.id AND d.status = 1
      WHERE m.id = ?
      GROUP BY m.id`,
      [id]
    );
    
    return success({
      id: updatedMeal[0].id,
      name: updatedMeal[0].name,
      status: updatedMeal[0].status,
      createdAt: updatedMeal[0].created_at,
      dishes: parseDishes(updatedMeal[0].dish_ids, updatedMeal[0].dish_names)
    }, '点餐活动更新成功');
  });
}

/**
 * 删除点餐活动（软删除）
 * @param {Object} data - 删除数据
 * @param {Object} context - 上下文
 * @returns {Object} 删除结果
 */
async function deleteMeal(data, context) {
  const { id } = data || {};
  
  if (!id) {
    return paramError('点餐ID不能为空');
  }
  
  const userId = getUserId(context);
  
  // 检查点餐是否存在且属于当前用户
  const existingMeal = await query(
    'SELECT id FROM wte_meals WHERE id = ? AND user_id = ?',
    [id, userId]
  );
  
  if (existingMeal.length === 0) {
    return notFound('点餐活动不存在');
  }
  
  return await transaction(async (connection) => {
    // 删除菜品关联
    await connection.execute(
      'UPDATE wte_meal_dishes SET status = 0 WHERE meal_id = ?',
      [id]
    );
    
    // 删除点餐
    await connection.execute(
      'DELETE FROM wte_meals WHERE id = ?',
      [id]
    );
    
    return success(null, '点餐活动删除成功');
  });
}

/**
 * 获取点餐列表
 * @param {Object} data - 查询参数
 * @param {Object} context - 上下文
 * @returns {Object} 点餐列表
 */
async function listMeals(data, context) {
  const { status, kitchenId, page = 1, pageSize = 100 } = data || {};
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
  
  let sql = `
    SELECT m.id, m.name, m.status, m.created_at, m.closed_at,
      COUNT(DISTINCT md.dish_id) as dish_count,
      COUNT(DISTINCT o.user_id) as orderer_count
    FROM wte_meals m
    LEFT JOIN wte_meal_dishes md ON m.id = md.meal_id AND md.status = 1
    LEFT JOIN wte_orders o ON m.id = o.meal_id AND o.status = 1
    WHERE m.user_id = ? AND m.kitchen_id = ?
  `;
  const params = [userId, targetKitchenId];
  
  if (status !== undefined && status !== null) {
    sql += ' AND m.status = ?';
    params.push(status);
  }
  
  sql += ' GROUP BY m.id ORDER BY m.status ASC, m.created_at DESC';
  
  // 分页
  const offset = (page - 1) * pageSize;
  sql += ' LIMIT ? OFFSET ?';
  params.push(parseInt(pageSize), offset);
  
  const meals = await query(sql, params);
  
  // 获取总数
  let countSql = 'SELECT COUNT(*) as total FROM wte_meals WHERE user_id = ? AND kitchen_id = ?';
  const countParams = [userId, targetKitchenId];
  
  if (status !== undefined && status !== null) {
    countSql += ' AND status = ?';
    countParams.push(status);
  }
  
  const countResult = await query(countSql, countParams);
  
  return success({
    list: meals.map(meal => ({
      id: meal.id,
      name: meal.name,
      status: meal.status,
      createdAt: meal.created_at,
      closedAt: meal.closed_at,
      dishCount: meal.dish_count,
      ordererCount: meal.orderer_count
    })),
    total: countResult[0].total,
    page: parseInt(page),
    pageSize: parseInt(pageSize)
  });
}

/**
 * 获取单个点餐详情
 * @param {Object} data - 查询参数
 * @param {Object} context - 上下文
 * @returns {Object} 点餐详情
 */
async function getMeal(data, context) {
  const { id } = data || {};
  
  if (!id) {
    return paramError('点餐ID不能为空');
  }
  
  const userId = getUserId(context);
  
  // 获取点餐基本信息
  const meal = await query(
    'SELECT id, name, status, created_at, closed_at FROM wte_meals WHERE id = ? AND user_id = ?',
    [id, userId]
  );
  
  if (meal.length === 0) {
    return notFound('点餐活动不存在');
  }
  
  // 获取关联的菜品
  const dishes = await query(
    `SELECT d.id, d.name, d.description
    FROM wte_dishes d
    INNER JOIN wte_meal_dishes md ON d.id = md.dish_id
    WHERE md.meal_id = ? AND md.status = 1 AND d.status = 1
    ORDER BY d.created_at DESC`,
    [id]
  );
  
  // 获取每个菜品的点选情况
  const dishOrders = await query(
    `SELECT o.dish_id, u.nickname
    FROM wte_orders o
    INNER JOIN wte_users u ON o.user_id = u.id
    WHERE o.meal_id = ? AND o.status = 1`,
    [id]
  );
  
  // 构建菜品点选映射
  const dishOrderMap = {};
  dishOrders.forEach(order => {
    if (!dishOrderMap[order.dish_id]) {
      dishOrderMap[order.dish_id] = [];
    }
    dishOrderMap[order.dish_id].push(order.nickname);
  });
  
  return success({
    id: meal[0].id,
    name: meal[0].name,
    status: meal[0].status,
    createdAt: meal[0].created_at,
    closedAt: meal[0].closed_at,
    dishes: dishes.map(dish => ({
      id: dish.id,
      name: dish.name,
      description: dish.description,
      orderers: dishOrderMap[dish.id] || []
    }))
  });
}

/**
 * 收单（关闭点餐活动）
 * @param {Object} data - 收单数据
 * @param {Object} context - 上下文
 * @returns {Object} 收单结果
 */
async function closeMeal(data, context) {
  const { id } = data || {};
  
  if (!id) {
    return paramError('点餐ID不能为空');
  }
  
  const userId = getUserId(context);
  
  // 检查点餐是否存在且属于当前用户
  const existingMeal = await query(
    'SELECT id, status FROM wte_meals WHERE id = ? AND user_id = ?',
    [id, userId]
  );
  
  if (existingMeal.length === 0) {
    return notFound('点餐活动不存在');
  }
  
  if (existingMeal[0].status === 2) {
    return error('该点餐活动已经收单');
  }
  
  await query(
    'UPDATE wte_meals SET status = 2, closed_at = NOW() WHERE id = ?',
    [id]
  );
  
  return success(null, '收单成功');
}

/**
 * 解析菜品字符串为数组
 * @param {string} ids - 菜品ID字符串（逗号分隔）
 * @param {string} names - 菜品名称字符串（逗号分隔）
 * @returns {Array} 菜品数组
 */
function parseDishes(ids, names) {
  if (!ids) return [];
  
  const idArray = ids.split(',');
  const nameArray = names ? names.split(',') : [];
  
  return idArray.map((id, index) => ({
    id: parseInt(id),
    name: nameArray[index] || ''
  }));
}
