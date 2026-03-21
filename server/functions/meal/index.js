/**
 * 点餐管理云函数
 * 提供点餐活动的增删改查、收单等功能
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
      case 'reopen':
        return await reopenMeal(data, context);
      case 'generateShareLink':
        return await generateShareLink(data, context);
      case 'getByShareToken':
        return await getByShareToken(data, context);
      default:
        return paramError('未知的操作类型');
    }
  } catch (err) {
    console.error('Meal function error:', err);
    return error(err.message || '操作失败');
  }
};

/**
 * 获取或创建默认厨房
 * @param {number} userId - 用户ID
 * @returns {Promise<number>} 厨房ID
 */
async function getOrCreateDefaultKitchen(userId) {
  // 先查找用户的默认厨房
  const defaultKitchen = await query(
    'SELECT id FROM wte_kitchens WHERE user_id = ? AND is_default = 1 AND status = 1',
    [userId]
  );

  if (defaultKitchen.length > 0) {
    return defaultKitchen[0].id;
  }

  // 查找用户的任意一个厨房
  const anyKitchen = await query(
    'SELECT id FROM wte_kitchens WHERE user_id = ? AND status = 1 ORDER BY created_at DESC LIMIT 1',
    [userId]
  );

  if (anyKitchen.length > 0) {
    // 将这个厨房设为默认
    await query(
      'UPDATE wte_kitchens SET is_default = 1 WHERE id = ?',
      [anyKitchen[0].id]
    );
    return anyKitchen[0].id;
  }

  // 用户没有厨房，创建一个默认厨房
  const result = await query(
    'INSERT INTO wte_kitchens (user_id, name, is_default, status) VALUES (?, ?, 1, 1)',
    [userId, '我的厨房']
  );

  return result.insertId;
}

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
  
  const userId = await getUserId(data, context);
  const trimmedName = name.trim();

  // 如果没有提供kitchenId，获取或创建用户的默认厨房
  let targetKitchenId = kitchenId;
  if (!targetKitchenId) {
    targetKitchenId = await getOrCreateDefaultKitchen(userId);
  } else {
    // 验证用户有权限操作该厨房（owner 或 admin）
    const role = await checkKitchenMembership(kitchenId, userId);
    if (!role) {
      return notFound('厨房不存在或无权限访问');
    }
    targetKitchenId = kitchenId;
  }
  
  return await transaction(async (connection) => {
    // 创建点餐活动
    const [mealResult] = await connection.query(
      'INSERT INTO wte_meals (user_id, kitchen_id, name) VALUES (?, ?, ?)',
      [userId, targetKitchenId, trimmedName]
    );
    
    const mealId = mealResult.insertId;

    // 验证菜品是否都存在且状态正常
    const placeholders = dishIds.map(() => '?').join(',');
    const [validDishes] = await connection.query(
      `SELECT id FROM wte_dishes WHERE id IN (${placeholders}) AND status = 1`,
      [...dishIds]
    );

    if (validDishes.length !== dishIds.length) {
      throw new Error('部分菜品不存在');
    }
    
    // 关联菜品
    for (const dishId of dishIds) {
      await connection.query(
        'INSERT INTO wte_meal_dishes (meal_id, dish_id) VALUES (?, ?)',
        [mealId, dishId]
      );
    }
    
    // 返回完整的点餐信息
    const [newMeal] = await connection.query(
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
  
  const userId = await getUserId(data, context);
  const trimmedName = name.trim();
  
  // 检查点餐是否存在
  const existingMeal = await query(
    'SELECT id, status, kitchen_id FROM wte_meals WHERE id = ?',
    [id]
  );
  
  if (existingMeal.length === 0) {
    return notFound('点餐活动不存在');
  }

  const role = await checkKitchenMembership(existingMeal[0].kitchen_id, userId);
  if (!role) return error('无权限操作该点餐活动');
  
  if (existingMeal[0].status === 2) {
    return error('已收单的点餐活动不能修改');
  }
  
  return await transaction(async (connection) => {
    await connection.query(
      'UPDATE wte_meals SET name = ? WHERE id = ?',
      [trimmedName, id]
    );
    
    const placeholders = dishIds.map(() => '?').join(',');
    const [validDishes] = await connection.query(
      `SELECT id FROM wte_dishes WHERE id IN (${placeholders}) AND status = 1`,
      [...dishIds]
    );
    
    if (validDishes.length !== dishIds.length) {
      throw new Error('部分菜品不存在或不属于当前用户');
    }
    
    // 删除旧的菜品关联
    await connection.query(
      'UPDATE wte_meal_dishes SET status = 0 WHERE meal_id = ?',
      [id]
    );
    
    // 添加新的菜品关联
    for (const dishId of dishIds) {
      await connection.query(
        'INSERT INTO wte_meal_dishes (meal_id, dish_id) VALUES (?, ?) ON DUPLICATE KEY UPDATE status = 1',
        [id, dishId]
      );
    }
    
    // 返回更新后的点餐信息
    const [updatedMeal] = await connection.query(
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
  
  const userId = await getUserId(data, context);
  
  const existingMeal = await query(
    'SELECT id, kitchen_id FROM wte_meals WHERE id = ?',
    [id]
  );
  
  if (existingMeal.length === 0) {
    return notFound('点餐活动不存在');
  }

  const role = await checkKitchenMembership(existingMeal[0].kitchen_id, userId);
  if (!role) return error('无权限操作该点餐活动');
  
  return await transaction(async (connection) => {
    await connection.query(
      'UPDATE wte_meal_dishes SET status = 0 WHERE meal_id = ?',
      [id]
    );
    
    // 删除点餐
    await connection.query(
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
  const userId = await getUserId(data, context);
  
  // 如果没有提供kitchenId，获取或创建用户的默认厨房
  let targetKitchenId = kitchenId;
  if (!targetKitchenId) {
    targetKitchenId = await getOrCreateDefaultKitchen(userId);
  } else {
    // 校验用户对该厨房的访问权限
    const role = await checkKitchenMembership(targetKitchenId, userId);
    if (!role) {
      return error('无权限访问该厨房');
    }
  }
  
  // 只返回当前厨房的 meal，不混入用户在其他厨房下过单的 meal
  // ordered_dish_count: 至少有一个人点过的菜品数量
  let sql = `
    SELECT m.id, m.name, m.status, m.created_at, m.closed_at,
      m.user_id as creator_user_id,
      u.nickname as creator_name,
      COUNT(DISTINCT md.dish_id) as dish_count,
      COUNT(DISTINCT o.user_id) as orderer_count,
      (SELECT COUNT(DISTINCT o2.dish_id) FROM wte_orders o2 WHERE o2.meal_id = m.id AND o2.status = 1) as ordered_dish_count
    FROM wte_meals m
    LEFT JOIN wte_users u ON m.user_id = u.id
    LEFT JOIN wte_meal_dishes md ON m.id = md.meal_id AND md.status = 1
    LEFT JOIN wte_orders o ON m.id = o.meal_id AND o.status = 1
    WHERE m.kitchen_id = ?
  `;
  const params = [targetKitchenId];
  
  if (status !== undefined && status !== null) {
    sql += ' AND m.status = ?';
    params.push(status);
  }
  
  sql += ' GROUP BY m.id ORDER BY m.created_at DESC';
  
  // 分页
  const offset = (page - 1) * pageSize;
  sql += ' LIMIT ? OFFSET ?';
  params.push(parseInt(pageSize), offset);
  
  const meals = await query(sql, params);
  
  // 获取总数
  let countSql = `
    SELECT COUNT(*) as total
    FROM wte_meals m
    WHERE m.kitchen_id = ?
  `;
  const countParams = [targetKitchenId];
  
  if (status !== undefined && status !== null) {
    countSql += ' AND m.status = ?';
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
      creatorUserId: meal.creator_user_id,
      creatorName: meal.creator_name,
      isCreator: meal.creator_user_id === userId,
      dishCount: meal.dish_count,
      orderedDishCount: parseInt(meal.ordered_dish_count) || 0,
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
  
  const userId = await getUserId(data, context);
  
  // 获取点餐基本信息（不限制用户，允许查看他人创建的点餐）
  const meal = await query(
    `SELECT m.id, m.user_id, m.kitchen_id, m.name, m.status, m.created_at, m.closed_at,
            u.nickname as creator_name
     FROM wte_meals m
     LEFT JOIN wte_users u ON m.user_id = u.id
     WHERE m.id = ?`,
    [id]
  );
  
  if (meal.length === 0) {
    return notFound('点餐活动不存在');
  }
  
  // 获取关联的菜品
  const dishes = await query(
    `SELECT d.id, d.name, d.description, d.image_url
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
  
  // Check if user is a kitchen member (for showing admin controls)
  const kitchenRole = meal[0].kitchen_id
    ? await checkKitchenMembership(meal[0].kitchen_id, userId)
    : null;

  return success({
    id: meal[0].id,
    name: meal[0].name,
    status: meal[0].status,
    isCreator: meal[0].user_id === userId,
    creatorName: meal[0].creator_name,
    isKitchenMember: !!kitchenRole,
    kitchenRole: kitchenRole,
    createdAt: meal[0].created_at,
    closedAt: meal[0].closed_at,
    dishes: dishes.map(dish => ({
      id: dish.id,
      name: dish.name,
      description: dish.description,
      imageUrl: dish.image_url,
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

  const userId = await getUserId(data, context);

  const existingMeal = await query(
    'SELECT id, status, kitchen_id FROM wte_meals WHERE id = ?',
    [id]
  );

  if (existingMeal.length === 0) return notFound('点餐活动不存在');

  const role = await checkKitchenMembership(existingMeal[0].kitchen_id, userId);
  if (!role) return error('无权限操作该点餐活动');

  if (existingMeal[0].status === 2) return error('该点餐活动已经收单');

  await query('UPDATE wte_meals SET status = 2, closed_at = NOW() WHERE id = ?', [id]);

  return success(null, '收单成功');
}

/**
 * 恢复点餐（将已收单的点餐恢复为点餐中状态）
 */
async function reopenMeal(data, context) {
  const { id } = data || {};
  if (!id) return paramError('点餐ID不能为空');

  const userId = await getUserId(data, context);

  const existingMeal = await query(
    'SELECT id, status, kitchen_id FROM wte_meals WHERE id = ?',
    [id]
  );

  if (existingMeal.length === 0) return notFound('点餐活动不存在');

  const role = await checkKitchenMembership(existingMeal[0].kitchen_id, userId);
  if (!role) return error('无权限操作该点餐活动');

  if (existingMeal[0].status === 1) return error('该点餐活动正在点餐中');

  await query('UPDATE wte_meals SET status = 1, closed_at = NULL WHERE id = ?', [id]);

  return success(null, '恢复点餐成功');
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

/**
 * 生成分享链接
 * @param {Object} data - 分享数据
 * @param {Object} context - 上下文
 * @returns {Object} 分享链接
 */
async function generateShareLink(data, context) {
  const { mealId } = data || {};

  if (!mealId) {
    return paramError('点餐ID不能为空');
  }

  const userId = await getUserId(data, context);

  // 验证点餐是否存在且用户有权限（owner 或 admin）
  const meal = await query(
    'SELECT id, name, status, kitchen_id FROM wte_meals WHERE id = ? AND status = 1',
    [mealId]
  );

  if (meal.length === 0) {
    return notFound('点餐活动不存在或已关闭');
  }

  const role = await checkKitchenMembership(meal[0].kitchen_id, userId);
  if (!role) {
    return error('无权限分享该点餐活动');
  }

  // 复用已有的分享令牌（避免重复创建）
  const existing = await query(
    'SELECT share_token FROM wte_meal_shares WHERE meal_id = ? AND created_by = ? AND status = 1 ORDER BY id DESC LIMIT 1',
    [mealId, userId]
  );

  let shareToken;
  if (existing.length > 0) {
    shareToken = existing[0].share_token;
  } else {
    shareToken = `share_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    await query(
      'INSERT INTO wte_meal_shares (meal_id, share_token, created_by) VALUES (?, ?, ?)',
      [mealId, shareToken, userId]
    );
  }

  return success({
    shareToken,
    mealId,
    shareUrl: `/pages/share-meal/share-meal?token=${shareToken}&mealId=${mealId}`
  }, '分享链接生成成功');
}

/**
 * 通过分享令牌获取点餐详情
 * @param {Object} data - 请求数据
 * @param {Object} context - 上下文
 * @returns {Object} 点餐详情
 */
async function getByShareToken(data, context) {
  const { shareToken, mealId } = data || {};

  if (!shareToken || !mealId) {
    return paramError('分享令牌和点餐ID不能为空');
  }

  // 验证分享令牌是否有效
  const shareRecord = await query(
    'SELECT id, meal_id FROM wte_meal_shares WHERE share_token = ? AND meal_id = ? AND status = 1',
    [shareToken, mealId]
  );

  if (shareRecord.length === 0) {
    return notFound('分享链接已失效或不存在');
  }

  // 获取点餐详情
  const meal = await query(
    `SELECT m.id, m.name, m.status, m.created_at, u.nickname as creator_name
     FROM wte_meals m
     LEFT JOIN wte_users u ON m.user_id = u.id
     WHERE m.id = ? AND m.status = 1`,
    [mealId]
  );

  if (meal.length === 0) {
    return notFound('点餐活动不存在或已关闭');
  }

  // 获取关联的菜品
  const dishes = await query(
    `SELECT d.id, d.name, d.description, d.image_url
     FROM wte_meal_dishes md
     JOIN wte_dishes d ON md.dish_id = d.id
     WHERE md.meal_id = ? AND md.status = 1 AND d.status = 1`,
    [mealId]
  );

  // 获取订单统计
  const orders = await query(
    `SELECT o.dish_id, u.nickname as orderer_name
     FROM wte_orders o
     LEFT JOIN wte_users u ON o.user_id = u.id
     WHERE o.meal_id = ? AND o.status = 1`,
    [mealId]
  );

  console.log('Orders query result:', orders);
  console.log('First order keys:', orders.length > 0 ? Object.keys(orders[0]) : 'no orders');

  // 构建菜品点选信息
  const dishOrderersMap = {};
  orders.forEach(order => {
    if (!dishOrderersMap[order.dish_id]) {
      dishOrderersMap[order.dish_id] = [];
    }
    // 直接使用 nickname 字段
    const ordererName = order.orderer_name || order.nickname;
    if (ordererName) {
      dishOrderersMap[order.dish_id].push(ordererName);
    }
  });

  console.log('Dish orderers map:', dishOrderersMap);

  const dishesWithOrderers = dishes.map(dish => ({
    id: dish.id,
    name: dish.name,
    description: dish.description,
    imageUrl: dish.image_url,
    orderers: dishOrderersMap[dish.id] || [],
    orderCount: (dishOrderersMap[dish.id] || []).length
  }));

  return success({
    id: meal[0].id,
    name: meal[0].name,
    status: meal[0].status,
    createdAt: meal[0].created_at,
    creatorName: meal[0].creator_name,
    dishes: dishesWithOrderers
  });
}
