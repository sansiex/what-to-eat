/**
 * 订单管理云函数
 * 提供下单、取消订单、查询订单等功能
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
        return await createOrder(data, context);
      case 'cancel':
        return await cancelOrder(data, context);
      case 'listByMeal':
        return await listOrdersByMeal(data, context);
      case 'listByUser':
        return await listOrdersByUser(data, context);
      case 'getMyOrder':
        return await getMyOrder(data, context);
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
  const { mealId, dishIds } = data || {};
  
  if (!mealId) {
    return paramError('点餐ID不能为空');
  }
  
  if (!dishIds || !Array.isArray(dishIds) || dishIds.length === 0) {
    return paramError('请至少选择一个菜品');
  }
  
  const userId = getUserId(context);
  
  return await transaction(async (connection) => {
    // 检查点餐活动是否存在且处于点餐中状态
    const [meal] = await connection.execute(
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
    const [validDishes] = await connection.execute(
      `SELECT dish_id FROM wte_meal_dishes 
       WHERE meal_id = ? AND dish_id IN (${placeholders}) AND status = 1`,
      [mealId, ...dishIds]
    );
    
    if (validDishes.length !== dishIds.length) {
      throw new Error('部分菜品不在该点餐活动中');
    }
    
    // 取消用户之前在该点餐活动中的所有订单
    await connection.execute(
      'UPDATE wte_orders SET status = 0, canceled_at = NOW() WHERE meal_id = ? AND user_id = ? AND status = 1',
      [mealId, userId]
    );
    
    // 创建新订单
    const orderIds = [];
    for (const dishId of dishIds) {
      const [result] = await connection.execute(
        'INSERT INTO wte_orders (meal_id, user_id, dish_id) VALUES (?, ?, ?)',
        [mealId, userId, dishId]
      );
      orderIds.push(result.insertId);
    }
    
    // 返回订单信息
    const [orders] = await connection.execute(
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
  
  const userId = getUserId(context);
  
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
  
  const userId = getUserId(context);
  
  // 检查点餐活动是否存在且属于当前用户
  const meal = await query(
    'SELECT id FROM wte_meals WHERE id = ? AND user_id = ?',
    [mealId, userId]
  );
  
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
  const userId = getUserId(context);
  
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
  
  const userId = getUserId(context);
  
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
      ordered: false,
      dishes: []
    });
  }
  
  return success({
    mealId,
    ordered: true,
    dishes: orders.map(order => ({
      id: order.dish_id,
      name: order.dish_name
    }))
  });
}
