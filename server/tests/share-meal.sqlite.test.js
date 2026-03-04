/**
 * 分享点餐功能单元测试 (SQLite版本)
 * 使用内存数据库，无需外部MySQL服务
 */

const { success, error, paramError, notFound } = require('../functions/utils/response');
const {
  cleanupTestData,
  createTestUser,
  createTestDish,
  createTestMeal,
  linkDishToMeal,
  testQuery,
  mockContext,
  closeTestDB
} = require('./sqlite-setup');

// 模拟分享功能云函数
async function shareMealMain(event, context) {
  const { action, data } = event;
  const userId = context?.userId;

  try {
    switch (action) {
      case 'generateShareLink': {
        // 生成分享链接
        const { mealId } = data || {};

        if (!mealId) {
          return paramError('点餐ID不能为空');
        }

        // 验证点餐是否存在且属于当前用户
        const meal = testQuery(
          'SELECT id, name, status FROM wte_meals WHERE id = ? AND user_id = ? AND status = 1',
          [mealId, userId]
        );

        if (meal.length === 0) {
          return notFound('点餐活动不存在或已关闭');
        }

        // 生成分享令牌
        const shareToken = `share_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

        // 保存分享记录
        testQuery(
          'INSERT INTO wte_meal_shares (meal_id, share_token, created_by) VALUES (?, ?, ?)',
          [mealId, shareToken, userId]
        );

        return success({
          shareToken,
          mealId,
          shareUrl: `/pages/share-meal/share-meal?token=${shareToken}&mealId=${mealId}`
        }, '分享链接生成成功');
      }

      case 'getByShareToken': {
        // 通过分享令牌获取点餐详情（不需要登录）
        const { shareToken, mealId } = data || {};

        if (!shareToken || !mealId) {
          return paramError('分享令牌和点餐ID不能为空');
        }

        // 验证分享令牌是否有效
        const shareRecord = testQuery(
          'SELECT id, meal_id FROM wte_meal_shares WHERE share_token = ? AND meal_id = ? AND status = 1',
          [shareToken, mealId]
        );

        if (shareRecord.length === 0) {
          return notFound('分享链接已失效或不存在');
        }

        // 获取点餐详情
        const meal = testQuery(
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
        const dishes = testQuery(
          `SELECT d.id, d.name
           FROM wte_meal_dishes md
           JOIN wte_dishes d ON md.dish_id = d.id
           WHERE md.meal_id = ? AND md.status = 1 AND d.status = 1`,
          [mealId]
        );

        // 获取订单统计（使用新的表结构 wte_order_dishes）
        const orders = testQuery(
          `SELECT od.dish_id, u.nickname as orderer_name
           FROM wte_orders o
           INNER JOIN wte_order_dishes od ON o.id = od.order_id AND od.status = 1
           LEFT JOIN wte_users u ON o.user_id = u.id
           WHERE o.meal_id = ? AND o.status = 1`,
          [mealId]
        );

        // 构建菜品点选信息
        const dishOrderersMap = {};
        orders.forEach(order => {
          if (!dishOrderersMap[order.dish_id]) {
            dishOrderersMap[order.dish_id] = [];
          }
          dishOrderersMap[order.dish_id].push(order.orderer_name);
        });

        const dishesWithOrderers = dishes.map(dish => ({
          ...dish,
          orderers: dishOrderersMap[dish.id] || [],
          orderCount: (dishOrderersMap[dish.id] || []).length
        }));

        return success({
          id: meal[0].id,
          name: meal[0].name,
          status: meal[0].status,
          createdAt: meal[0].createdAt,
          creatorName: meal[0].creatorName,
          dishes: dishesWithOrderers
        });
      }

      default:
        return paramError('未知的操作类型');
    }
  } catch (err) {
    console.error('Share meal function error:', err);
    return error(err.message || '操作失败');
  }
}

// 模拟匿名下单云函数
async function anonymousOrderMain(event, context) {
  const { action, data } = event;

  try {
    switch (action) {
      case 'create': {
        // 匿名用户下单
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

        // 验证分享令牌是否有效
        const shareRecord = testQuery(
          'SELECT id FROM wte_meal_shares WHERE share_token = ? AND meal_id = ? AND status = 1',
          [shareToken, mealId]
        );

        if (shareRecord.length === 0) {
          return notFound('分享链接已失效');
        }

        // 验证点餐是否处于进行中状态
        const meal = testQuery(
          'SELECT id, status FROM wte_meals WHERE id = ? AND status = 1',
          [mealId]
        );

        if (meal.length === 0) {
          return error('该点餐活动已结束');
        }

        // 创建匿名用户（如果不存在）
        let anonymousUser = testQuery(
          "SELECT id FROM wte_users WHERE nickname = ? AND openid LIKE 'anonymous_%'",
          [userName.trim()]
        );

        let userId;
        if (anonymousUser.length === 0) {
          const result = testQuery(
            'INSERT INTO wte_users (openid, nickname) VALUES (?, ?)',
            [`anonymous_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`, userName.trim()]
          );
          userId = result.insertId;
        } else {
          userId = anonymousUser[0].id;
        }

        // 创建订单
        const orderResult = testQuery(
          'INSERT INTO wte_orders (meal_id, user_id, status) VALUES (?, ?, 1)',
          [mealId, userId]
        );

        const orderId = orderResult.insertId;

        // 关联菜品
        for (const dishId of dishIds) {
          testQuery(
            'INSERT INTO wte_order_dishes (order_id, dish_id) VALUES (?, ?)',
            [orderId, dishId]
          );
        }

        return success({
          orderId,
          userId,
          userName: userName.trim()
        }, '下单成功');
      }

      default:
        return paramError('未知的操作类型');
    }
  } catch (err) {
    console.error('Anonymous order function error:', err);
    return error(err.message || '操作失败');
  }
}

describe('分享点餐功能测试', () => {
  let testUserId;
  let testKitchenId;
  let testMealId;
  let testDishIds = [];
  let shareToken;

  beforeAll(() => {
    // 创建测试数据
    testUserId = createTestUser({ nickname: '分享测试用户' });
    
    // 获取默认厨房ID
    const kitchens = testQuery(
      'SELECT id FROM wte_kitchens WHERE user_id = ? AND is_default = 1',
      [testUserId]
    );
    testKitchenId = kitchens[0].id;

    // 创建测试菜品
    const dish1Id = createTestDish(testUserId, testKitchenId, { name: '测试菜品1' });
    const dish2Id = createTestDish(testUserId, testKitchenId, { name: '测试菜品2' });
    testDishIds = [dish1Id, dish2Id];

    // 创建测试点餐
    testMealId = createTestMeal(testUserId, testKitchenId, { name: '分享测试点餐' });

    // 关联菜品
    linkDishToMeal(testMealId, dish1Id);
    linkDishToMeal(testMealId, dish2Id);
  });

  afterAll(() => {
    cleanupTestData();
    closeTestDB();
  });

  describe('生成分享链接', () => {
    it('应该成功生成分享链接', async () => {
      const event = {
        action: 'generateShareLink',
        data: { mealId: testMealId }
      };
      const context = mockContext(testUserId);

      const result = await shareMealMain(event, context);

      expect(result.success).toBe(true);
      expect(result.data.shareToken).toBeDefined();
      expect(result.data.mealId).toBe(testMealId);
      expect(result.data.shareUrl).toContain('token=');
      expect(result.data.shareUrl).toContain('mealId=');

      shareToken = result.data.shareToken;
    });

    it('没有mealId应该返回参数错误', async () => {
      const event = {
        action: 'generateShareLink',
        data: {}
      };
      const context = mockContext(testUserId);

      const result = await shareMealMain(event, context);

      expect(result.success).toBe(false);
      expect(result.code).toBe(400);
    });

    it('不存在的mealId应该返回404', async () => {
      const event = {
        action: 'generateShareLink',
        data: { mealId: 99999 }
      };
      const context = mockContext(testUserId);

      const result = await shareMealMain(event, context);

      expect(result.success).toBe(false);
      expect(result.code).toBe(404);
    });
  });

  describe('通过分享令牌获取点餐详情', () => {
    beforeAll(async () => {
      // 如果还没有 shareToken，先生成一个
      if (!shareToken) {
        const event = {
          action: 'generateShareLink',
          data: { mealId: testMealId }
        };
        const context = mockContext(testUserId);
        const result = await shareMealMain(event, context);
        if (result.success) {
          shareToken = result.data.shareToken;
        }
      }
    });

    it('应该成功获取点餐详情', async () => {
      const event = {
        action: 'getByShareToken',
        data: { shareToken, mealId: testMealId }
      };

      const result = await shareMealMain(event, null);

      expect(result.success).toBe(true);
      expect(result.data.id).toBe(testMealId);
      expect(result.data.name).toBe('分享测试点餐');
      expect(result.data.dishes).toHaveLength(2);
      expect(result.data.creatorName).toBeDefined();
    });

    it('无效的分享令牌应该返回404', async () => {
      const event = {
        action: 'getByShareToken',
        data: { shareToken: 'invalid_token', mealId: testMealId }
      };

      const result = await shareMealMain(event, null);

      expect(result.success).toBe(false);
      expect(result.code).toBe(404);
    });

    it('缺少分享令牌应该返回参数错误', async () => {
      const event = {
        action: 'getByShareToken',
        data: { mealId: testMealId }
      };

      const result = await shareMealMain(event, null);

      expect(result.success).toBe(false);
      expect(result.code).toBe(400);
    });
  });

  describe('匿名用户下单', () => {
    beforeAll(async () => {
      // 确保有 shareToken，如果没有则生成一个
      if (!shareToken) {
        const event = {
          action: 'generateShareLink',
          data: { mealId: testMealId }
        };
        const context = mockContext(testUserId);
        const result = await shareMealMain(event, context);
        if (result.success) {
          shareToken = result.data.shareToken;
        }
      }
    });

    it('应该成功下单', async () => {
      const event = {
        action: 'create',
        data: {
          mealId: testMealId,
          dishIds: [testDishIds[0]],
          shareToken,
          userName: '匿名用户A'
        }
      };

      const result = await anonymousOrderMain(event, null);

      expect(result.success).toBe(true);
      expect(result.data.orderId).toBeDefined();
      expect(result.data.userId).toBeDefined();
      expect(result.data.userName).toBe('匿名用户A');
    });

    it('缺少用户名应该返回参数错误', async () => {
      const event = {
        action: 'create',
        data: {
          mealId: testMealId,
          dishIds: [testDishIds[0]],
          shareToken,
          userName: ''
        }
      };

      const result = await anonymousOrderMain(event, null);

      expect(result.success).toBe(false);
      expect(result.code).toBe(400);
    });

    it('无效的分享令牌应该返回404', async () => {
      const event = {
        action: 'create',
        data: {
          mealId: testMealId,
          dishIds: [testDishIds[0]],
          shareToken: 'invalid_token',
          userName: '匿名用户B'
        }
      };

      const result = await anonymousOrderMain(event, null);

      expect(result.success).toBe(false);
      expect(result.code).toBe(404);
    });

    it('已关闭的点餐应该返回错误', async () => {
      // 关闭点餐
      testQuery(
        'UPDATE wte_meals SET status = 2 WHERE id = ?',
        [testMealId]
      );

      const event = {
        action: 'create',
        data: {
          mealId: testMealId,
          dishIds: [testDishIds[0]],
          shareToken,
          userName: '匿名用户C'
        }
      };

      const result = await anonymousOrderMain(event, null);

      expect(result.success).toBe(false);

      // 恢复点餐状态
      testQuery(
        'UPDATE wte_meals SET status = 1 WHERE id = ?',
        [testMealId]
      );
    });
  });
});
