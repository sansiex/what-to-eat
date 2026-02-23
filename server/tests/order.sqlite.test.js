/**
 * 订单管理云函数单元测试 (SQLite版本)
 * 使用内存数据库，无需外部MySQL服务
 */

const { success, error, paramError, notFound } = require('../functions/utils/response');
const {
  cleanupTestData,
  createTestUser,
  createTestDish,
  createTestMeal,
  linkDishToMeal,
  createTestOrder,
  testQuery,
  mockContext,
  closeTestDB
} = require('./sqlite-setup');

// 模拟订单云函数
async function orderMain(event, context) {
  const { action, data } = event;
  const userId = context.userId;

  try {
    switch (action) {
      case 'create': {
        const { mealId, dishIds } = data || {};

        if (!mealId) {
          return paramError('点餐ID不能为空');
        }

        if (!dishIds || !Array.isArray(dishIds) || dishIds.length === 0) {
          return paramError('请至少选择一个菜品');
        }

        // 检查点餐活动是否存在且处于点餐中状态
        const meal = testQuery(
          'SELECT id, status, user_id as creator_id FROM wte_meals WHERE id = ?',
          [mealId]
        );

        if (meal.length === 0) {
          return error('点餐活动不存在');
        }

        if (meal[0].status === 2) {
          return error('该点餐活动已收单，无法下单');
        }

        // 检查菜品是否都在该点餐活动中
        for (const dishId of dishIds) {
          const validDish = testQuery(
            'SELECT dish_id FROM wte_meal_dishes WHERE meal_id = ? AND dish_id = ? AND status = 1',
            [mealId, dishId]
          );
          if (validDish.length === 0) {
            return error('部分菜品不在该点餐活动中');
          }
        }

        // 取消用户之前在该点餐活动中的所有订单
        testQuery(
          'UPDATE wte_orders SET status = 0, canceled_at = CURRENT_TIMESTAMP WHERE meal_id = ? AND user_id = ? AND status = 1',
          [mealId, userId]
        );

        // 创建新订单
        const orderIds = [];
        for (const dishId of dishIds) {
          const result = testQuery(
            'INSERT INTO wte_orders (meal_id, user_id, dish_id) VALUES (?, ?, ?)',
            [mealId, userId, dishId]
          );
          orderIds.push(result.insertId);
        }

        // 返回订单信息
        const orders = [];
        for (const orderId of orderIds) {
          const order = testQuery(
            `SELECT o.id, o.dish_id, d.name as dish_name, o.created_at
             FROM wte_orders o
             INNER JOIN wte_dishes d ON o.dish_id = d.id
             WHERE o.id = ?`,
            [orderId]
          );
          if (order.length > 0) {
            orders.push(order[0]);
          }
        }

        return success({
          mealId,
          orders: orders.map(order => ({
            id: order.id,
            dishId: order.dishId,
            dishName: order.dishName,
            createdAt: order.createdAt
          }))
        }, '下单成功');
      }

      case 'cancel': {
        const { mealId } = data || {};

        if (!mealId) {
          return paramError('点餐ID不能为空');
        }

        // 检查点餐活动是否存在
        const meal = testQuery(
          'SELECT id, status FROM wte_meals WHERE id = ?',
          [mealId]
        );

        if (meal.length === 0) {
          return notFound('点餐活动不存在');
        }

        if (meal[0].status === 2) {
          return error('该点餐活动已收单，无法取消订单');
        }

        // 检查用户是否有订单
        const existingOrders = testQuery(
          'SELECT id FROM wte_orders WHERE meal_id = ? AND user_id = ? AND status = 1',
          [mealId, userId]
        );

        if (existingOrders.length === 0) {
          return error('您没有在该点餐活动中的订单');
        }

        // 取消订单
        testQuery(
          'UPDATE wte_orders SET status = 0, canceled_at = CURRENT_TIMESTAMP WHERE meal_id = ? AND user_id = ? AND status = 1',
          [mealId, userId]
        );

        return success(null, '订单取消成功');
      }

      case 'listByMeal': {
        const { mealId } = data || {};

        if (!mealId) {
          return paramError('点餐ID不能为空');
        }

        // 检查点餐是否存在且属于当前用户
        const meal = testQuery(
          'SELECT id FROM wte_meals WHERE id = ? AND user_id = ?',
          [mealId, userId]
        );

        if (meal.length === 0) {
          return notFound('点餐活动不存在');
        }

        // 获取订单统计
        const stats = testQuery(
          `SELECT 
            d.id as dish_id,
            d.name as dish_name,
            COUNT(o.id) as order_count,
            GROUP_CONCAT(DISTINCT u.nickname) as orderer_names
          FROM wte_dishes d
          INNER JOIN wte_meal_dishes md ON d.id = md.dish_id AND md.meal_id = ? AND md.status = 1
          LEFT JOIN wte_orders o ON d.id = o.dish_id AND o.meal_id = ? AND o.status = 1
          LEFT JOIN wte_users u ON o.user_id = u.id
          WHERE d.status = 1
          GROUP BY d.id
          ORDER BY order_count DESC`,
          [mealId, mealId]
        );

        return success({
          mealId,
          stats: stats.map(s => ({
            dishId: s.dishId || s.dish_id,
            dishName: s.dishName || s.dish_name,
            orderCount: s.orderCount || s.order_count,
            ordererNames: (s.ordererNames || s.orderer_names) ? (s.ordererNames || s.orderer_names).split(',') : []
          }))
        });
      }

      case 'listByUser': {
        const { page = 1, pageSize = 20 } = data || {};

        // 获取用户的订单历史
        let sql = `
          SELECT 
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
        `;

        const offset = (page - 1) * pageSize;
        sql += ' LIMIT ? OFFSET ?';

        const orders = testQuery(sql, [userId, parseInt(pageSize), offset]);

        // 获取总数
        const countResult = testQuery(
          'SELECT COUNT(*) as total FROM wte_orders WHERE user_id = ?',
          [userId]
        );

        return success({
          list: orders.map(o => ({
            id: o.id,
            mealId: o.mealId || o.meal_id,
            mealName: o.mealName || o.meal_name,
            dishId: o.dishId || o.dish_id,
            dishName: o.dishName || o.dish_name,
            status: o.status,
            createdAt: o.createdAt || o.created_at,
            canceledAt: o.canceledAt || o.canceled_at
          })),
          total: countResult[0].total,
          page: parseInt(page),
          pageSize: parseInt(pageSize)
        });
      }

      case 'getMyOrder': {
        const { mealId } = data || {};

        if (!mealId) {
          return paramError('点餐ID不能为空');
        }

        // 获取用户在该点餐中的订单
        const orders = testQuery(
          `SELECT 
            o.id,
            o.dish_id,
            d.name as dish_name,
            o.created_at
          FROM wte_orders o
          INNER JOIN wte_dishes d ON o.dish_id = d.id
          WHERE o.meal_id = ? AND o.user_id = ? AND o.status = 1`,
          [mealId, userId]
        );

        if (orders.length === 0) {
          return success({ hasOrdered: false, orders: [] });
        }

        return success({
          hasOrdered: true,
          orders: orders.map(o => ({
            id: o.id,
            dishId: o.dishId || o.dish_id,
            dishName: o.dishName || o.dish_name,
            createdAt: o.createdAt || o.created_at
          }))
        });
      }

      default:
        return paramError('未知的操作类型');
    }
  } catch (err) {
    console.error('Order function error:', err);
    return error(err.message || '操作失败');
  }
}

describe('订单管理云函数测试 (SQLite)', () => {
  let testUserId;
  let otherUserId;
  let testKitchenId;
  let dishIds = [];
  let mealId;

  beforeEach(() => {
    cleanupTestData();
    testUserId = createTestUser();
    otherUserId = createTestUser({ openid: 'other_openid' });

    // 获取默认厨房ID
    const kitchens = testQuery(
      'SELECT id FROM wte_kitchens WHERE user_id = ? AND is_default = 1',
      [testUserId]
    );
    testKitchenId = kitchens[0]?.id;

    // 创建测试菜品
    dishIds = [
      createTestDish(testUserId, testKitchenId, { name: '菜品A' }),
      createTestDish(testUserId, testKitchenId, { name: '菜品B' }),
      createTestDish(testUserId, testKitchenId, { name: '菜品C' })
    ];

    // 创建点餐活动
    const mealResult = testQuery(
      'INSERT INTO wte_meals (user_id, kitchen_id, name) VALUES (?, ?, ?)',
      [testUserId, testKitchenId, '测试点餐']
    );
    mealId = mealResult.insertId;

    // 关联菜品到点餐
    for (const dishId of dishIds) {
      linkDishToMeal(mealId, dishId);
    }
  });

  afterAll(() => {
    cleanupTestData();
    closeTestDB();
  });

  describe('创建订单', () => {
    test('成功下单', async () => {
      const event = {
        action: 'create',
        data: {
          mealId: mealId,
          dishIds: [dishIds[0]]
        }
      };
      const context = mockContext(otherUserId);

      const result = await orderMain(event, context);

      expect(result.success).toBe(true);
      expect(result.code).toBe(0);
      expect(result.data.mealId).toBe(mealId);
      expect(result.data.orders.length).toBe(1);
    });

    test('下单失败-点餐不存在', async () => {
      const event = {
        action: 'create',
        data: {
          mealId: 99999,
          dishIds: [dishIds[0]]
        }
      };
      const context = mockContext(otherUserId);

      const result = await orderMain(event, context);

      expect(result.success).toBe(false);
      expect(result.code).toBe(-1);
    });

    test('下单失败-已收单', async () => {
      // 先将点餐收单
      testQuery(
        'UPDATE wte_meals SET status = 2 WHERE id = ?',
        [mealId]
      );

      const event = {
        action: 'create',
        data: {
          mealId: mealId,
          dishIds: [dishIds[0]]
        }
      };
      const context = mockContext(otherUserId);

      const result = await orderMain(event, context);

      expect(result.success).toBe(false);
      expect(result.code).toBe(-1);
    });

    test('下单失败-未选择菜品', async () => {
      const event = {
        action: 'create',
        data: {
          mealId: mealId
        }
      };
      const context = mockContext(otherUserId);

      const result = await orderMain(event, context);

      expect(result.success).toBe(false);
      expect(result.code).toBe(400);
    });

    test('重复下单会覆盖之前的订单', async () => {
      const context = mockContext(otherUserId);

      // 第一次下单
      await orderMain({
        action: 'create',
        data: { mealId: mealId, dishIds: [dishIds[0]] }
      }, context);

      // 第二次下单
      const result = await orderMain({
        action: 'create',
        data: { mealId: mealId, dishIds: [dishIds[1], dishIds[2]] }
      }, context);

      expect(result.success).toBe(true);
      expect(result.data.orders.length).toBe(2);

      // 验证旧订单已被取消
      const oldOrders = testQuery(
        'SELECT * FROM wte_orders WHERE meal_id = ? AND user_id = ? AND dish_id = ? AND status = 1',
        [mealId, otherUserId, dishIds[0]]
      );
      expect(oldOrders.length).toBe(0);
    });
  });

  describe('取消订单', () => {
    test('成功取消订单', async () => {
      const context = mockContext(otherUserId);

      // 先下单
      await orderMain({
        action: 'create',
        data: { mealId: mealId, dishIds: [dishIds[0]] }
      }, context);

      // 取消订单
      const event = {
        action: 'cancel',
        data: { mealId: mealId }
      };

      const result = await orderMain(event, context);

      expect(result.success).toBe(true);
      expect(result.message).toBe('订单取消成功');
    });

    test('取消订单失败-已收单', async () => {
      const context = mockContext(otherUserId);

      // 先下单
      await orderMain({
        action: 'create',
        data: { mealId: mealId, dishIds: [dishIds[0]] }
      }, context);

      // 收单
      testQuery(
        'UPDATE wte_meals SET status = 2 WHERE id = ?',
        [mealId]
      );

      // 尝试取消
      const event = {
        action: 'cancel',
        data: { mealId: mealId }
      };

      const result = await orderMain(event, context);

      expect(result.success).toBe(false);
      expect(result.code).toBe(-1);
    });

    test('取消订单失败-没有订单', async () => {
      const event = {
        action: 'cancel',
        data: { mealId: mealId }
      };
      const context = mockContext(otherUserId);

      const result = await orderMain(event, context);

      expect(result.success).toBe(false);
      expect(result.code).toBe(-1);
    });
  });

  describe('获取订单列表', () => {
    test('成功获取点餐活动的订单统计', async () => {
      const context = mockContext(otherUserId);

      // 其他用户下单
      await orderMain({
        action: 'create',
        data: { mealId: mealId, dishIds: [dishIds[0], dishIds[1]] }
      }, context);

      // 获取统计（以点餐创建者身份）
      const event = {
        action: 'listByMeal',
        data: { mealId: mealId }
      };
      const ownerContext = mockContext(testUserId);

      const result = await orderMain(event, ownerContext);

      expect(result.success).toBe(true);
      expect(result.data.stats.length).toBe(3); // 3个菜品
      expect(result.data.stats[0].orderCount).toBe(1);
    });

    test('获取用户订单历史', async () => {
      const context = mockContext(otherUserId);

      // 下单
      await orderMain({
        action: 'create',
        data: { mealId: mealId, dishIds: [dishIds[0]] }
      }, context);

      const event = {
        action: 'listByUser',
        data: { page: 1, pageSize: 10 }
      };

      const result = await orderMain(event, context);

      expect(result.success).toBe(true);
      expect(result.data.list.length).toBe(1);
      expect(result.data.total).toBe(1);
    });
  });

  describe('获取我的订单', () => {
    test('已下单', async () => {
      const context = mockContext(otherUserId);

      // 先下单
      await orderMain({
        action: 'create',
        data: { mealId: mealId, dishIds: [dishIds[0]] }
      }, context);

      const event = {
        action: 'getMyOrder',
        data: { mealId: mealId }
      };

      const result = await orderMain(event, context);

      expect(result.success).toBe(true);
      expect(result.data.hasOrdered).toBe(true);
      expect(result.data.orders.length).toBe(1);
    });

    test('未下单', async () => {
      const event = {
        action: 'getMyOrder',
        data: { mealId: mealId }
      };
      const context = mockContext(otherUserId);

      const result = await orderMain(event, context);

      expect(result.success).toBe(true);
      expect(result.data.hasOrdered).toBe(false);
      expect(result.data.orders.length).toBe(0);
    });
  });
});
