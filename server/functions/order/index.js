/**
 * 订单管理云函数
 * 提供下单、取消订单、查询订单等功能
 */

const cloud = require('wx-server-sdk');
const { query, transaction, getUserId } = require('./utils/db');
const { success, error, paramError, notFound } = require('./utils/response');
const { notifyMealCreatorOnNewOrder } = require('./utils/subscribe-notify');
const {
  assertParticipantSlotForOrder,
  insertParticipantIfNeeded
} = require('./utils/meal-participants');

try {
  cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
} catch (e) {
  console.warn('wx-server-sdk init:', e && e.message);
}
const {
  isValidTag,
  buildDishTagDisplaysByDishId,
  parseTagsColumn,
  serializeTagsForDb,
  expandOrderRowsToTagRows,
  mergeTagsIntoList,
  removeTagFromList
} = require('./utils/tag-registry');

/** 校验并合并客户端传入的某道菜标签列表（辣度互斥等） */
function normalizeTagsPayloadList(rawList) {
  if (rawList == null) return [];
  if (!Array.isArray(rawList)) {
    throw new Error('标签数据格式错误');
  }
  let list = [];
  for (const t of rawList) {
    const cat = t.categoryKey || t.category;
    const code = t.tagCode || t.code;
    if (!cat || !code || !isValidTag(cat, code)) {
      throw new Error('无效的标签');
    }
    list = mergeTagsIntoList(list, [{ categoryKey: cat, tagCode: code }]);
  }
  return list;
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
        return await createOrder(data, context);
      case 'cancel':
        return await cancelOrder(data, context);
      case 'listByMeal':
        return await listOrdersByMeal(data, context);
      case 'listByUser':
        return await listOrdersByUser(data, context);
      case 'getMyOrder':
        return await getMyOrder(data, context);
      case 'createAnonymous':
        return await createAnonymousOrder(data, context);
      case 'addDishTags':
        return await addDishTags(data, context);
      case 'removeDishTag':
        return await removeDishTag(data, context);
      case 'listMealDishTags':
        return await listMealDishTags(data, context);
      default:
        return paramError('未知的操作类型');
    }
  } catch (err) {
    console.error('Order function error:', err);
    return error(err.message || '操作失败');
  }
};

/**
 * 创建订单（下单）
 * @param {Object} data - 订单数据
 * @param {Object} context - 上下文
 * @returns {Object} 创建结果
 */
async function createOrder(data, context) {
  const { mealId, dishIds, dishTagsByDishId } = data || {};
  
  if (!mealId) {
    return paramError('点餐ID不能为空');
  }
  
  if (!dishIds || !Array.isArray(dishIds) || dishIds.length === 0) {
    return paramError('请至少选择一个菜品');
  }
  
  const userId = await getUserId(data, context);

  const result = await transaction(async (connection) => {
    // 检查点餐活动是否存在且处于点餐中状态
    const [meal] = await connection.query(
      'SELECT id, status, user_id as creator_id FROM wte_meals WHERE id = ?',
      [mealId]
    );
    
    if (meal.length === 0) {
      throw new Error('点餐活动不存在');
    }
    
    if (meal[0].status === 2) {
      throw new Error('该点餐活动已收单，无法下单');
    }
    
    // 检查菜品是否都在该点餐活动中
    const placeholders = dishIds.map(() => '?').join(',');
    const [validDishes] = await connection.query(
      `SELECT dish_id FROM wte_meal_dishes 
       WHERE meal_id = ? AND dish_id IN (${placeholders}) AND status = 1`,
      [mealId, ...dishIds]
    );
    
    if (validDishes.length !== dishIds.length) {
      throw new Error('部分菜品不在该点餐活动中');
    }

    await assertParticipantSlotForOrder(connection, mealId, userId);

    const [prevRows] = await connection.query(
      'SELECT dish_id, tags FROM wte_orders WHERE meal_id = ? AND user_id = ? AND status = 1',
      [mealId, userId]
    );
    const tagsByDishId = {};
    prevRows.forEach(r => {
      tagsByDishId[r.dish_id] = r.tags;
    });

    const hasExplicitTags =
      dishTagsByDishId !== undefined &&
      dishTagsByDishId !== null &&
      typeof dishTagsByDishId === 'object' &&
      !Array.isArray(dishTagsByDishId);

    // 取消用户之前在该点餐活动中的所有订单
    await connection.query(
      'UPDATE wte_orders SET status = 0, canceled_at = NOW() WHERE meal_id = ? AND user_id = ? AND status = 1',
      [mealId, userId]
    );

    // 创建新订单；若带 dishTagsByDishId 则按本次提交写入标签，否则沿用旧逻辑（同菜保留库中标签）
    const orderIds = [];
    for (const dishId of dishIds) {
      let list = [];
      if (hasExplicitTags) {
        const raw = dishTagsByDishId[dishId] ?? dishTagsByDishId[String(dishId)];
        list = normalizeTagsPayloadList(raw == null ? [] : raw);
      } else {
        list = parseTagsColumn(tagsByDishId[dishId]);
      }
      const tagsVal = list.length === 0 ? null : serializeTagsForDb(list);
      const [result] = await connection.query(
        'INSERT INTO wte_orders (meal_id, user_id, dish_id, tags) VALUES (?, ?, ?, ?)',
        [mealId, userId, dishId, tagsVal]
      );
      orderIds.push(result.insertId);
    }

    await insertParticipantIfNeeded(connection, mealId, userId);

    // 返回订单信息
    const [orders] = await connection.query(
      `SELECT o.id, o.dish_id, d.name as dish_name, o.created_at
       FROM wte_orders o
       INNER JOIN wte_dishes d ON o.dish_id = d.id
       WHERE o.id IN (${orderIds.map(() => '?').join(',')})`,
      orderIds
    );

    return success({
      mealId,
      orders: orders.map(order => ({
        id: order.id,
        dishId: order.dish_id,
        dishName: order.dish_name,
        createdAt: order.created_at
      }))
    }, '下单成功');
  });

  if (result && result.success && result.data && result.data.mealId) {
    notifyMealCreatorOnNewOrder(query, result.data.mealId, userId, null).catch((err) => {
      console.warn('notifyMealCreatorOnNewOrder:', err && err.message);
    });
  }

  return result;
}

/**
 * 取消订单
 * @param {Object} data - 取消数据
 * @param {Object} context - 上下文
 * @returns {Object} 取消结果
 */
async function cancelOrder(data, context) {
  const { mealId } = data || {};
  
  if (!mealId) {
    return paramError('点餐ID不能为空');
  }
  
  const userId = await getUserId(data, context);
  
  // 检查点餐活动是否存在
  const meal = await query(
    'SELECT id, status FROM wte_meals WHERE id = ?',
    [mealId]
  );
  
  if (meal.length === 0) {
    return notFound('点餐活动不存在');
  }
  
  if (meal[0].status === 2) {
    return error('该点餐活动已收单，无法取消订单');
  }
  
  // 取消用户的所有订单
  const result = await query(
    'UPDATE wte_orders SET status = 0, canceled_at = NOW() WHERE meal_id = ? AND user_id = ? AND status = 1',
    [mealId, userId]
  );
  
  if (result.affectedRows === 0) {
    return error('您没有在该点餐活动中的订单');
  }
  
  return success(null, '订单取消成功');
}

/**
 * 获取某个点餐活动的所有订单
 * @param {Object} data - 查询参数
 * @param {Object} context - 上下文
 * @returns {Object} 订单列表
 */
async function listOrdersByMeal(data, context) {
  const { mealId } = data || {};
  
  if (!mealId) {
    return paramError('点餐ID不能为空');
  }
  
  await getUserId(data, context);

  // 任意参与点餐的用户都需要看到各菜点选统计，与 meal.get 一致：只校验点餐存在，不要求当前用户是发起人
  const meal = await query('SELECT id FROM wte_meals WHERE id = ?', [mealId]);

  if (meal.length === 0) {
    return notFound('点餐活动不存在');
  }
  
  // 获取订单统计
  const orders = await query(
    `SELECT 
       d.id as dish_id,
       d.name as dish_name,
       COUNT(o.id) as order_count,
       GROUP_CONCAT(u.nickname) as orderers
     FROM wte_dishes d
     INNER JOIN wte_meal_dishes md ON d.id = md.dish_id AND md.meal_id = ? AND md.status = 1
     LEFT JOIN wte_orders o ON d.id = o.dish_id AND o.meal_id = ? AND o.status = 1
     LEFT JOIN wte_users u ON o.user_id = u.id
     WHERE d.status = 1
     GROUP BY d.id
     ORDER BY order_count DESC, d.name ASC`,
    [mealId, mealId]
  );
  
  // 获取参与点餐的用户列表
  const participants = await query(
    `SELECT DISTINCT u.id, u.nickname, u.avatar_url
     FROM wte_users u
     INNER JOIN wte_orders o ON u.id = o.user_id
     WHERE o.meal_id = ? AND o.status = 1`,
    [mealId]
  );
  
  return success({
    mealId,
    participantCount: participants.length,
    participants: participants.map(p => ({
      id: p.id,
      nickname: p.nickname,
      avatarUrl: p.avatar_url
    })),
    dishOrders: orders.map(order => ({
      dishId: order.dish_id,
      dishName: order.dish_name,
      orderCount: order.order_count,
      orderers: order.orderers ? order.orderers.split(',') : []
    }))
  });
}

/**
 * 获取用户的订单历史
 * @param {Object} data - 查询参数
 * @param {Object} context - 上下文
 * @returns {Object} 订单列表
 */
async function listOrdersByUser(data, context) {
  const { page = 1, pageSize = 20 } = data || {};
  const userId = await getUserId(data, context);
  
  const offset = (page - 1) * pageSize;
  
  // 获取用户的订单历史
  const orders = await query(
    `SELECT 
       o.id,
       o.meal_id,
       m.name as meal_name,
       o.dish_id,
       d.name as dish_name,
       o.status,
       o.created_at,
       o.canceled_at
     FROM wte_orders o
     INNER JOIN wte_meals m ON o.meal_id = m.id
     INNER JOIN wte_dishes d ON o.dish_id = d.id
     WHERE o.user_id = ?
     ORDER BY o.created_at DESC
     LIMIT ? OFFSET ?`,
    [userId, parseInt(pageSize), offset]
  );
  
  // 获取总数
  const countResult = await query(
    'SELECT COUNT(*) as total FROM wte_orders WHERE user_id = ?',
    [userId]
  );
  
  return success({
    list: orders.map(order => ({
      id: order.id,
      mealId: order.meal_id,
      mealName: order.meal_name,
      dishId: order.dish_id,
      dishName: order.dish_name,
      status: order.status,
      createdAt: order.created_at,
      canceledAt: order.canceled_at
    })),
    total: countResult[0].total,
    page: parseInt(page),
    pageSize: parseInt(pageSize)
  });
}

/**
 * 获取用户在某个点餐活动中的订单
 * @param {Object} data - 查询参数
 * @param {Object} context - 上下文
 * @returns {Object} 订单信息
 */
async function getMyOrder(data, context) {
  const { mealId } = data || {};

  if (!mealId) {
    return paramError('点餐ID不能为空');
  }

  const userId = await getUserId(data, context);

  // 获取用户的订单
  const orders = await query(
    `SELECT
       o.id,
       o.dish_id,
       d.name as dish_name,
       o.created_at
     FROM wte_orders o
     INNER JOIN wte_dishes d ON o.dish_id = d.id
     WHERE o.meal_id = ? AND o.user_id = ? AND o.status = 1
     ORDER BY o.created_at DESC`,
    [mealId, userId]
  );

  if (orders.length === 0) {
    return success({
      mealId,
      hasOrdered: false,
      orders: []
    });
  }

  return success({
    mealId,
    hasOrdered: true,
    orders: orders.map(order => ({
      dishId: order.dish_id,
      dishName: order.dish_name,
      createdAt: order.created_at
    }))
  });
}

/**
 * 匿名用户下单（通过分享链接）
 * @param {Object} data - 订单数据
 * @param {Object} context - 上下文
 * @returns {Object} 创建结果
 */
async function createAnonymousOrder(data, context) {
  const { mealId, dishIds, shareToken, userName } = data || {};

  if (!mealId || !dishIds || !Array.isArray(dishIds) || dishIds.length === 0) {
    return paramError('点餐ID和菜品不能为空');
  }

  if (!shareToken) {
    return paramError('分享令牌不能为空');
  }

  if (!userName || userName.trim() === '') {
    return paramError('请输入您的姓名');
  }

  const result = await transaction(async (connection) => {
    // 验证分享令牌是否有效
    const [shareRecord] = await connection.query(
      'SELECT id FROM wte_meal_shares WHERE share_token = ? AND meal_id = ? AND status = 1',
      [shareToken, mealId]
    );

    if (shareRecord.length === 0) {
      throw new Error('分享链接已失效');
    }

    // 验证点餐是否处于进行中状态
    const [meal] = await connection.query(
      'SELECT id, status FROM wte_meals WHERE id = ? AND status = 1',
      [mealId]
    );

    if (meal.length === 0) {
      throw new Error('该点餐活动已结束');
    }

    // 检查菜品是否都在该点餐活动中
    const placeholders = dishIds.map(() => '?').join(',');
    const [validDishes] = await connection.query(
      `SELECT dish_id FROM wte_meal_dishes 
       WHERE meal_id = ? AND dish_id IN (${placeholders}) AND status = 1`,
      [mealId, ...dishIds]
    );

    if (validDishes.length !== dishIds.length) {
      throw new Error('部分菜品不在该点餐活动中');
    }

    // 创建或查找匿名用户
    const trimmedName = userName.trim();
    const [existingUser] = await connection.query(
      'SELECT id FROM wte_users WHERE nickname = ? AND openid LIKE "anonymous_%"',
      [trimmedName]
    );

    let userId;
    if (existingUser.length === 0) {
      const [result] = await connection.query(
        'INSERT INTO wte_users (openid, nickname) VALUES (?, ?)',
        [`anonymous_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`, trimmedName]
      );
      userId = result.insertId;
    } else {
      userId = existingUser[0].id;
    }

    await assertParticipantSlotForOrder(connection, mealId, userId);

    const [prevRowsAnon] = await connection.query(
      'SELECT dish_id, tags FROM wte_orders WHERE meal_id = ? AND user_id = ? AND status = 1',
      [mealId, userId]
    );
    const tagsByDishIdAnon = {};
    prevRowsAnon.forEach(r => {
      tagsByDishIdAnon[r.dish_id] = r.tags;
    });

    // 取消该用户之前在该点餐活动中的所有订单
    await connection.query(
      'UPDATE wte_orders SET status = 0, canceled_at = NOW() WHERE meal_id = ? AND user_id = ? AND status = 1',
      [mealId, userId]
    );

    // 创建新订单（同菜重新下单时保留原标签）
    const orderIds = [];
    for (const dishId of dishIds) {
      const kept = parseTagsColumn(tagsByDishIdAnon[dishId]);
      const tagsVal = kept.length === 0 ? null : serializeTagsForDb(kept);
      const [result] = await connection.query(
        'INSERT INTO wte_orders (meal_id, user_id, dish_id, tags) VALUES (?, ?, ?, ?)',
        [mealId, userId, dishId, tagsVal]
      );
      orderIds.push(result.insertId);
    }

    await insertParticipantIfNeeded(connection, mealId, userId);

    return success({
      orderId: orderIds[0],
      userId,
      userName: trimmedName
    }, '下单成功');
  });

  if (result && result.success && result.data && result.data.userId != null) {
    notifyMealCreatorOnNewOrder(query, mealId, result.data.userId, result.data.userName).catch((err) => {
      console.warn('notifyMealCreatorOnNewOrder (anonymous):', err && err.message);
    });
  }

  return result;
}

async function assertMealOpenWithDishTx(connection, mealId, dishId) {
  const [meal] = await connection.query('SELECT id, status FROM wte_meals WHERE id = ?', [mealId]);
  if (meal.length === 0) throw new Error('点餐活动不存在');
  if (meal[0].status !== 1) throw new Error('该点餐已结束，不能修改标签');
  const [md] = await connection.query(
    'SELECT 1 as ok FROM wte_meal_dishes WHERE meal_id = ? AND dish_id = ? AND status = 1',
    [mealId, dishId]
  );
  if (md.length === 0) throw new Error('菜品不在该点餐中');
}

/**
 * 批量添加标签（辣度类同一菜仅保留最新一条）
 */
async function addDishTags(data, context) {
  const { mealId, dishId, tags } = data || {};
  if (!mealId || !dishId) return paramError('点餐与菜品不能为空');
  if (!tags || !Array.isArray(tags) || tags.length === 0) return paramError('请至少选择一个标签');

  const normalized = [];
  for (const raw of tags) {
    const category = raw.categoryKey || raw.category;
    const tagCode = raw.tagCode || raw.code;
    if (!category || !tagCode || !isValidTag(category, tagCode)) {
      return paramError('无效的标签');
    }
    normalized.push({ categoryKey: category, tagCode });
  }

  const userId = await getUserId(data, context);

  try {
    return await transaction(async (connection) => {
      await assertMealOpenWithDishTx(connection, mealId, dishId);

      const [rows] = await connection.query(
        'SELECT id, tags FROM wte_orders WHERE meal_id = ? AND user_id = ? AND dish_id = ? AND status = 1 LIMIT 1',
        [mealId, userId, dishId]
      );
      if (rows.length === 0) {
        throw new Error('请先下单该菜品后再添加标签');
      }

      const existing = parseTagsColumn(rows[0].tags);
      const merged = mergeTagsIntoList(existing, normalized);
      const serialized = merged.length === 0 ? null : serializeTagsForDb(merged);
      await connection.query('UPDATE wte_orders SET tags = ? WHERE id = ?', [serialized, rows[0].id]);

      return success({ mealId, dishId }, '标签已更新');
    });
  } catch (err) {
    console.error('addDishTags:', err);
    return error(err.message || '添加标签失败');
  }
}

async function removeDishTag(data, context) {
  const { mealId, dishId, categoryKey, tagCode, category } = data || {};
  const cat = categoryKey || category;
  if (!mealId || !dishId || !cat || !tagCode) return paramError('参数不完整');
  if (!isValidTag(cat, tagCode)) return paramError('无效的标签');

  const userId = await getUserId(data, context);

  try {
    return await transaction(async (connection) => {
      await assertMealOpenWithDishTx(connection, mealId, dishId);
      const [rows] = await connection.query(
        'SELECT id, tags FROM wte_orders WHERE meal_id = ? AND user_id = ? AND dish_id = ? AND status = 1 LIMIT 1',
        [mealId, userId, dishId]
      );
      if (rows.length === 0) {
        throw new Error('未找到该菜品的订单');
      }
      const existing = parseTagsColumn(rows[0].tags);
      const merged = removeTagFromList(existing, cat, tagCode);
      const serialized = merged.length === 0 ? null : serializeTagsForDb(merged);
      await connection.query('UPDATE wte_orders SET tags = ? WHERE id = ?', [serialized, rows[0].id]);
      return success(null, '已移除标签');
    });
  } catch (err) {
    console.error('removeDishTag:', err);
    return error(err.message || '移除标签失败');
  }
}

async function listMealDishTags(data, context) {
  const { mealId } = data || {};
  if (!mealId) return paramError('点餐ID不能为空');

  const userId = await getUserId(data, context);
  const meal = await query('SELECT id FROM wte_meals WHERE id = ?', [mealId]);
  if (meal.length === 0) return notFound('点餐活动不存在');

  const orderRows = await query(
    `SELECT o.dish_id, o.user_id, o.tags, u.nickname as nickname
     FROM wte_orders o
     INNER JOIN wte_users u ON o.user_id = u.id
     WHERE o.meal_id = ? AND o.status = 1`,
    [mealId]
  );
  const tagRows = expandOrderRowsToTagRows(orderRows);
  const map = buildDishTagDisplaysByDishId(tagRows, userId);
  const byDish = {};
  map.forEach((v, dishId) => {
    byDish[dishId] = v.tagDisplay;
  });

  return success({ mealId, byDish });
}
