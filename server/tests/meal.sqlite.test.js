/**
 * 点餐管理云函数单元测试 (SQLite版本)
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

// 辅助函数：解析菜品列表
function parseDishes(dishIds, dishNames) {
  if (!dishIds || !dishNames) return [];
  const ids = dishIds.toString().split(',');
  const names = dishNames.toString().split(',');
  return ids.map((id, index) => ({
    id: parseInt(id),
    name: names[index] || ''
  }));
}

// 模拟点餐云函数
async function mealMain(event, context) {
  const { action, data } = event;
  const userId = context.userId;
  
  try {
    switch (action) {
      case 'create': {
        const { name, dishIds } = data || {};
        
        if (!name || name.trim() === '') {
          return paramError('点餐名称不能为空');
        }
        
        if (!dishIds || !Array.isArray(dishIds) || dishIds.length === 0) {
          return paramError('请至少选择一个菜品');
        }
        
        const trimmedName = name.trim();
        
        // 获取默认厨房
        const kitchens = testQuery(
          'SELECT id FROM wte_kitchens WHERE user_id = ? AND is_default = 1 AND status = 1',
          [userId]
        );
        
        if (kitchens.length === 0) {
          return error('未找到默认厨房');
        }
        
        const kitchenId = kitchens[0].id;
        
        // 验证菜品是否都属于当前用户和厨房
        const validDishes = [];
        for (const dishId of dishIds) {
          const dish = testQuery(
            'SELECT id FROM wte_dishes WHERE id = ? AND user_id = ? AND kitchen_id = ? AND status = 1',
            [dishId, userId, kitchenId]
          );
          if (dish.length > 0) {
            validDishes.push(dish[0]);
          }
        }
        
        if (validDishes.length !== dishIds.length) {
          return error('部分菜品不存在或不属于当前用户');
        }
        
        // 创建点餐活动
        const mealResult = testQuery(
          'INSERT INTO wte_meals (user_id, kitchen_id, name) VALUES (?, ?, ?)',
          [userId, kitchenId, trimmedName]
        );
        
        const mealId = mealResult.insertId;
        
        // 关联菜品
        for (const dishId of dishIds) {
          testQuery(
            'INSERT INTO wte_meal_dishes (meal_id, dish_id) VALUES (?, ?)',
            [mealId, dishId]
          );
        }
        
        // 返回完整的点餐信息
        const newMeal = testQuery(
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
          createdAt: newMeal[0].createdAt,
          dishes: parseDishes(newMeal[0].dishIds || newMeal[0].dish_ids, newMeal[0].dishNames || newMeal[0].dish_names)
        }, '点餐活动创建成功');
      }
      
      case 'list': {
        const { status, page = 1, pageSize = 100 } = data || {};
        
        // 获取默认厨房
        const kitchens = testQuery(
          'SELECT id FROM wte_kitchens WHERE user_id = ? AND is_default = 1 AND status = 1',
          [userId]
        );
        
        if (kitchens.length === 0) {
          return error('未找到默认厨房');
        }
        
        const kitchenId = kitchens[0].id;
        
        let sql = `
          SELECT m.id, m.name, m.status, m.created_at, m.closed_at,
            COUNT(DISTINCT md.dish_id) as dish_count,
            COUNT(DISTINCT o.user_id) as orderer_count
          FROM wte_meals m
          LEFT JOIN wte_meal_dishes md ON m.id = md.meal_id AND md.status = 1
          LEFT JOIN wte_orders o ON m.id = o.meal_id AND o.status = 1
          WHERE m.user_id = ? AND m.kitchen_id = ?
        `;
        const params = [userId, kitchenId];
        
        if (status !== undefined && status !== null) {
          sql += ' AND m.status = ?';
          params.push(status);
        }
        
        sql += ' GROUP BY m.id ORDER BY m.status ASC, m.created_at DESC';
        
        // 分页
        const offset = (page - 1) * pageSize;
        sql += ' LIMIT ? OFFSET ?';
        params.push(parseInt(pageSize), offset);
        
        const meals = testQuery(sql, params);
        
        // 获取总数
        let countSql = 'SELECT COUNT(*) as total FROM wte_meals WHERE user_id = ? AND kitchen_id = ?';
        const countParams = [userId, kitchenId];
        
        if (status !== undefined && status !== null) {
          countSql += ' AND status = ?';
          countParams.push(status);
        }
        
        const countResult = testQuery(countSql, countParams);
        
        return success({
          list: meals.map(meal => ({
            id: meal.id,
            name: meal.name,
            status: meal.status,
            createdAt: meal.createdAt,
            closedAt: meal.closedAt,
            dishCount: meal.dishCount,
            ordererCount: meal.ordererCount
          })),
          total: countResult[0].total,
          page: parseInt(page),
          pageSize: parseInt(pageSize)
        });
      }
      
      case 'get': {
        const { id } = data || {};
        
        if (!id) {
          return paramError('点餐ID不能为空');
        }
        
        // 获取点餐基本信息
        const meal = testQuery(
          'SELECT id, name, status, created_at, closed_at FROM wte_meals WHERE id = ? AND user_id = ?',
          [id, userId]
        );
        
        if (meal.length === 0) {
          return notFound('点餐活动不存在');
        }
        
        // 获取关联的菜品
        const dishes = testQuery(
          `SELECT d.id, d.name, d.description
          FROM wte_dishes d
          INNER JOIN wte_meal_dishes md ON d.id = md.dish_id AND md.status = 1
          WHERE md.meal_id = ? AND d.status = 1`,
          [id]
        );
        
        return success({
          id: meal[0].id,
          name: meal[0].name,
          status: meal[0].status,
          createdAt: meal[0].createdAt,
          closedAt: meal[0].closedAt,
          dishes: dishes
        });
      }
      
      case 'update': {
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
        
        const trimmedName = name.trim();
        
        // 检查点餐是否存在且属于当前用户
        const existingMeal = testQuery(
          'SELECT id, status FROM wte_meals WHERE id = ? AND user_id = ?',
          [id, userId]
        );
        
        if (existingMeal.length === 0) {
          return notFound('点餐活动不存在');
        }
        
        if (existingMeal[0].status === 2) {
          return error('已收单的点餐活动不能修改');
        }
        
        // 验证菜品
        const validDishes = [];
        for (const dishId of dishIds) {
          const dish = testQuery(
            'SELECT id FROM wte_dishes WHERE id = ? AND user_id = ? AND status = 1',
            [dishId, userId]
          );
          if (dish.length > 0) {
            validDishes.push(dish[0]);
          }
        }
        
        if (validDishes.length !== dishIds.length) {
          return error('部分菜品不存在或不属于当前用户');
        }
        
        // 更新点餐名称
        testQuery(
          'UPDATE wte_meals SET name = ? WHERE id = ?',
          [trimmedName, id]
        );
        
        // 删除旧的菜品关联
        testQuery(
          'UPDATE wte_meal_dishes SET status = 0 WHERE meal_id = ?',
          [id]
        );
        
        // 添加新的菜品关联
        for (const dishId of dishIds) {
          testQuery(
            'INSERT INTO wte_meal_dishes (meal_id, dish_id) VALUES (?, ?)',
            [id, dishId]
          );
        }
        
        // 返回更新后的点餐信息
        const updatedMeal = testQuery(
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
          createdAt: updatedMeal[0].createdAt,
          dishes: parseDishes(updatedMeal[0].dishIds || updatedMeal[0].dish_ids, updatedMeal[0].dishNames || updatedMeal[0].dish_names)
        }, '点餐活动更新成功');
      }
      
      case 'delete': {
        const { id } = data || {};
        
        if (!id) {
          return paramError('点餐ID不能为空');
        }
        
        // 检查点餐是否存在且属于当前用户
        const existingMeal = testQuery(
          'SELECT id FROM wte_meals WHERE id = ? AND user_id = ?',
          [id, userId]
        );
        
        if (existingMeal.length === 0) {
          return notFound('点餐活动不存在');
        }
        
        // 删除菜品关联
        testQuery(
          'UPDATE wte_meal_dishes SET status = 0 WHERE meal_id = ?',
          [id]
        );
        
        // 删除点餐
        testQuery(
          'DELETE FROM wte_meals WHERE id = ?',
          [id]
        );
        
        return success(null, '点餐活动删除成功');
      }
      
      case 'close': {
        const { id } = data || {};
        
        if (!id) {
          return paramError('点餐ID不能为空');
        }
        
        // 检查点餐是否存在且属于当前用户
        const existingMeal = testQuery(
          'SELECT id, status FROM wte_meals WHERE id = ? AND user_id = ?',
          [id, userId]
        );
        
        if (existingMeal.length === 0) {
          return notFound('点餐活动不存在');
        }
        
        if (existingMeal[0].status === 2) {
          return error('该点餐活动已经收单');
        }
        
        // 更新状态为已收单
        testQuery(
          'UPDATE wte_meals SET status = 2, closed_at = CURRENT_TIMESTAMP WHERE id = ?',
          [id]
        );
        
        return success(null, '点餐活动收单成功');
      }
      
      default:
        return paramError('未知的操作类型');
    }
  } catch (err) {
    console.error('Meal function error:', err);
    return error(err.message || '操作失败');
  }
}

describe('点餐管理云函数测试 (SQLite)', () => {
  let testUserId;
  let testKitchenId;
  let dishIds = [];

  beforeEach(() => {
    cleanupTestData();
    testUserId = createTestUser();
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
  });

  afterAll(() => {
    cleanupTestData();
    closeTestDB();
  });

  describe('创建点餐', () => {
    test('成功创建点餐', async () => {
      const event = {
        action: 'create',
        data: {
          name: '午餐点餐',
          dishIds: [dishIds[0], dishIds[1]]
        }
      };
      const context = mockContext(testUserId);

      const result = await mealMain(event, context);

      expect(result.success).toBe(true);
      expect(result.code).toBe(0);
      expect(result.data.name).toBe('午餐点餐');
      expect(result.data.dishes.length).toBe(2);
    });

    test('创建点餐失败-名称为空', async () => {
      const event = {
        action: 'create',
        data: {
          name: '',
          dishIds: [dishIds[0]]
        }
      };
      const context = mockContext(testUserId);

      const result = await mealMain(event, context);

      expect(result.success).toBe(false);
      expect(result.code).toBe(400);
    });

    test('创建点餐失败-未选择菜品', async () => {
      const event = {
        action: 'create',
        data: {
          name: '测试点餐'
        }
      };
      const context = mockContext(testUserId);

      const result = await mealMain(event, context);

      expect(result.success).toBe(false);
      expect(result.code).toBe(400);
    });

    test('创建点餐失败-选择了不存在的菜品', async () => {
      const event = {
        action: 'create',
        data: {
          name: '测试点餐',
          dishIds: [99999]
        }
      };
      const context = mockContext(testUserId);

      const result = await mealMain(event, context);

      expect(result.success).toBe(false);
      expect(result.code).toBe(-1);
    });
  });

  describe('获取点餐列表', () => {
    test('成功获取点餐列表', async () => {
      const context = mockContext(testUserId);
      
      // 创建几个点餐
      await mealMain({
        action: 'create',
        data: { name: '点餐A', dishIds: [dishIds[0]] }
      }, context);
      await mealMain({
        action: 'create',
        data: { name: '点餐B', dishIds: [dishIds[1]] }
      }, context);

      const event = {
        action: 'list',
        data: { page: 1, pageSize: 10 }
      };

      const result = await mealMain(event, context);

      expect(result.success).toBe(true);
      expect(result.data.list.length).toBe(2);
      expect(result.data.total).toBe(2);
    });

    test('根据状态筛选点餐', async () => {
      const context = mockContext(testUserId);
      
      // 创建一个点餐并收单
      const createResult = await mealMain({
        action: 'create',
        data: { name: '已收单点餐', dishIds: [dishIds[0]] }
      }, context);
      
      await mealMain({
        action: 'close',
        data: { id: createResult.data.id }
      }, context);

      const event = {
        action: 'list',
        data: { status: 2 }
      };

      const result = await mealMain(event, context);

      expect(result.success).toBe(true);
      expect(result.data.list.length).toBe(1);
      expect(result.data.list[0].status).toBe(2);
    });
  });

  describe('获取单个点餐', () => {
    test('成功获取点餐详情', async () => {
      const context = mockContext(testUserId);
      const createResult = await mealMain({
        action: 'create',
        data: { name: '测试点餐', dishIds: [dishIds[0], dishIds[1]] }
      }, context);

      const event = {
        action: 'get',
        data: { id: createResult.data.id }
      };

      const result = await mealMain(event, context);

      expect(result.success).toBe(true);
      expect(result.data.name).toBe('测试点餐');
      expect(result.data.dishes.length).toBe(2);
    });

    test('获取点餐失败-点餐不存在', async () => {
      const event = {
        action: 'get',
        data: { id: 99999 }
      };
      const context = mockContext(testUserId);

      const result = await mealMain(event, context);

      expect(result.success).toBe(false);
      expect(result.code).toBe(404);
    });
  });

  describe('更新点餐', () => {
    test('成功更新点餐', async () => {
      const context = mockContext(testUserId);
      const createResult = await mealMain({
        action: 'create',
        data: { name: '原名称', dishIds: [dishIds[0]] }
      }, context);

      const event = {
        action: 'update',
        data: {
          id: createResult.data.id,
          name: '新名称',
          dishIds: [dishIds[0], dishIds[1]]
        }
      };

      const result = await mealMain(event, context);

      expect(result.success).toBe(true);
      expect(result.data.name).toBe('新名称');
      expect(result.data.dishes.length).toBe(2);
    });

    test('更新点餐失败-已收单', async () => {
      const context = mockContext(testUserId);
      const createResult = await mealMain({
        action: 'create',
        data: { name: '测试点餐', dishIds: [dishIds[0]] }
      }, context);
      
      // 先收单
      await mealMain({
        action: 'close',
        data: { id: createResult.data.id }
      }, context);

      const event = {
        action: 'update',
        data: {
          id: createResult.data.id,
          name: '新名称',
          dishIds: [dishIds[0]]
        }
      };

      const result = await mealMain(event, context);

      expect(result.success).toBe(false);
      expect(result.code).toBe(-1);
    });
  });

  describe('删除点餐', () => {
    test('成功删除点餐', async () => {
      const context = mockContext(testUserId);
      const createResult = await mealMain({
        action: 'create',
        data: { name: '要删除的点餐', dishIds: [dishIds[0]] }
      }, context);

      const event = {
        action: 'delete',
        data: { id: createResult.data.id }
      };

      const result = await mealMain(event, context);

      expect(result.success).toBe(true);
      expect(result.message).toBe('点餐活动删除成功');

      // 验证已删除
      const getResult = await mealMain({
        action: 'get',
        data: { id: createResult.data.id }
      }, context);
      expect(getResult.success).toBe(false);
    });
  });

  describe('收单', () => {
    test('成功收单', async () => {
      const context = mockContext(testUserId);
      const createResult = await mealMain({
        action: 'create',
        data: { name: '测试点餐', dishIds: [dishIds[0]] }
      }, context);

      const event = {
        action: 'close',
        data: { id: createResult.data.id }
      };

      const result = await mealMain(event, context);

      expect(result.success).toBe(true);
      expect(result.message).toBe('点餐活动收单成功');

      // 验证状态已更新
      const getResult = await mealMain({
        action: 'get',
        data: { id: createResult.data.id }
      }, context);
      expect(getResult.data.status).toBe(2);
    });

    test('收单失败-重复收单', async () => {
      const context = mockContext(testUserId);
      const createResult = await mealMain({
        action: 'create',
        data: { name: '测试点餐', dishIds: [dishIds[0]] }
      }, context);
      
      // 第一次收单
      await mealMain({
        action: 'close',
        data: { id: createResult.data.id }
      }, context);

      // 第二次收单
      const event = {
        action: 'close',
        data: { id: createResult.data.id }
      };

      const result = await mealMain(event, context);

      expect(result.success).toBe(false);
      expect(result.code).toBe(-1);
    });
  });
});
