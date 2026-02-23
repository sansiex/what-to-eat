/**
 * 点餐管理云函数单元测试
 * 测试点餐活动的增删改查、收单等功能
 */

const mealFunction = require('../functions/meal/index.js');
const {
  cleanupTestData,
  createTestUser,
  createTestDish,
  createTestMeal,
  linkDishToMeal,
  mockContext
} = require('./setup');

describe('点餐管理云函数测试', () => {
  let testUserId;
  let testDishIds = [];

  beforeEach(async () => {
    await cleanupTestData();
    testUserId = await createTestUser();
    testDishIds = [];
    
    // 创建测试菜品
    for (let i = 0; i < 3; i++) {
      const dishId = await createTestDish(testUserId, {
        name: `测试菜品${i + 1}`,
        description: `描述${i + 1}`
      });
      testDishIds.push(dishId);
    }
  });

  afterAll(async () => {
    await cleanupTestData();
  });

  describe('创建点餐活动', () => {
    test('成功创建点餐活动', async () => {
      const event = {
        action: 'create',
        data: {
          name: '午餐',
          dishIds: testDishIds
        }
      };
      const context = mockContext(testUserId);

      const result = await mealFunction.main(event, context);

      expect(result.success).toBe(true);
      expect(result.code).toBe(0);
      expect(result.data.name).toBe('午餐');
      expect(result.data.dishes.length).toBe(3);
      expect(result.data.status).toBe(1);
    });

    test('创建点餐失败-名称为空', async () => {
      const event = {
        action: 'create',
        data: {
          name: '',
          dishIds: testDishIds
        }
      };
      const context = mockContext(testUserId);

      const result = await mealFunction.main(event, context);

      expect(result.success).toBe(false);
      expect(result.code).toBe(400);
    });

    test('创建点餐失败-未选择菜品', async () => {
      const event = {
        action: 'create',
        data: {
          name: '午餐',
          dishIds: []
        }
      };
      const context = mockContext(testUserId);

      const result = await mealFunction.main(event, context);

      expect(result.success).toBe(false);
      expect(result.code).toBe(400);
    });

    test('创建点餐失败-菜品不存在', async () => {
      const event = {
        action: 'create',
        data: {
          name: '午餐',
          dishIds: [99999]
        }
      };
      const context = mockContext(testUserId);

      const result = await mealFunction.main(event, context);

      expect(result.success).toBe(false);
    });
  });

  describe('更新点餐活动', () => {
    let mealId;

    beforeEach(async () => {
      const createEvent = {
        action: 'create',
        data: {
          name: '午餐',
          dishIds: testDishIds
        }
      };
      const result = await mealFunction.main(createEvent, mockContext(testUserId));
      mealId = result.data.id;
    });

    test('成功更新点餐活动', async () => {
      const event = {
        action: 'update',
        data: {
          id: mealId,
          name: '晚餐',
          dishIds: [testDishIds[0], testDishIds[1]]
        }
      };
      const context = mockContext(testUserId);

      const result = await mealFunction.main(event, context);

      expect(result.success).toBe(true);
      expect(result.code).toBe(0);
      expect(result.data.name).toBe('晚餐');
      expect(result.data.dishes.length).toBe(2);
    });

    test('更新点餐失败-已收单', async () => {
      // 先收单
      await mealFunction.main(
        { action: 'close', data: { id: mealId } },
        mockContext(testUserId)
      );

      const event = {
        action: 'update',
        data: {
          id: mealId,
          name: '新名称',
          dishIds: testDishIds
        }
      };
      const context = mockContext(testUserId);

      const result = await mealFunction.main(event, context);

      expect(result.success).toBe(false);
      expect(result.code).toBe(-1);
    });
  });

  describe('收单', () => {
    let mealId;

    beforeEach(async () => {
      const createEvent = {
        action: 'create',
        data: {
          name: '午餐',
          dishIds: testDishIds
        }
      };
      const result = await mealFunction.main(createEvent, mockContext(testUserId));
      mealId = result.data.id;
    });

    test('成功收单', async () => {
      const event = {
        action: 'close',
        data: {
          id: mealId
        }
      };
      const context = mockContext(testUserId);

      const result = await mealFunction.main(event, context);

      expect(result.success).toBe(true);
      expect(result.code).toBe(0);

      // 验证状态已更新
      const getEvent = {
        action: 'get',
        data: {
          id: mealId
        }
      };
      const getResult = await mealFunction.main(getEvent, context);
      expect(getResult.data.status).toBe(2);
    });

    test('收单失败-重复收单', async () => {
      // 第一次收单
      await mealFunction.main(
        { action: 'close', data: { id: mealId } },
        mockContext(testUserId)
      );

      // 第二次收单
      const event = {
        action: 'close',
        data: {
          id: mealId
        }
      };
      const context = mockContext(testUserId);

      const result = await mealFunction.main(event, context);

      expect(result.success).toBe(false);
      expect(result.code).toBe(-1);
    });
  });

  describe('获取点餐列表', () => {
    beforeEach(async () => {
      // 创建多个点餐活动
      for (let i = 0; i < 3; i++) {
        const event = {
          action: 'create',
          data: {
            name: `点餐${i + 1}`,
            dishIds: testDishIds
          }
        };
        await mealFunction.main(event, mockContext(testUserId));
      }
    });

    test('成功获取点餐列表', async () => {
      const event = {
        action: 'list',
        data: {}
      };
      const context = mockContext(testUserId);

      const result = await mealFunction.main(event, context);

      expect(result.success).toBe(true);
      expect(result.code).toBe(0);
      expect(result.data.list.length).toBe(3);
    });

    test('按状态筛选', async () => {
      // 收单一个
      const listResult = await mealFunction.main(
        { action: 'list', data: {} },
        mockContext(testUserId)
      );
      const firstMealId = listResult.data.list[0].id;
      
      await mealFunction.main(
        { action: 'close', data: { id: firstMealId } },
        mockContext(testUserId)
      );

      const event = {
        action: 'list',
        data: {
          status: 2
        }
      };
      const context = mockContext(testUserId);

      const result = await mealFunction.main(event, context);

      expect(result.success).toBe(true);
      expect(result.data.list.length).toBe(1);
      expect(result.data.list[0].status).toBe(2);
    });
  });

  describe('获取点餐详情', () => {
    let mealId;

    beforeEach(async () => {
      const createEvent = {
        action: 'create',
        data: {
          name: '午餐',
          dishIds: testDishIds
        }
      };
      const result = await mealFunction.main(createEvent, mockContext(testUserId));
      mealId = result.data.id;
    });

    test('成功获取点餐详情', async () => {
      const event = {
        action: 'get',
        data: {
          id: mealId
        }
      };
      const context = mockContext(testUserId);

      const result = await mealFunction.main(event, context);

      expect(result.success).toBe(true);
      expect(result.code).toBe(0);
      expect(result.data.id).toBe(mealId);
      expect(result.data.name).toBe('午餐');
      expect(result.data.dishes.length).toBe(3);
    });

    test('获取详情失败-不存在', async () => {
      const event = {
        action: 'get',
        data: {
          id: 99999
        }
      };
      const context = mockContext(testUserId);

      const result = await mealFunction.main(event, context);

      expect(result.success).toBe(false);
      expect(result.code).toBe(404);
    });
  });
});
