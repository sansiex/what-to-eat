/**
 * 订单管理云函数单元测试
 * 测试下单、取消订单、查询订单等功能
 */

const orderFunction = require('../functions/order/index.js');
const mealFunction = require('../functions/meal/index.js');
const {
  cleanupTestData,
  createTestUser,
  createTestDish,
  mockContext
} = require('./setup');

describe('订单管理云函数测试', () => {
  let testUserId;
  let otherUserId;
  let testDishIds = [];
  let mealId;

  beforeEach(async () => {
    await cleanupTestData();
    testUserId = await createTestUser();
    otherUserId = await createTestUser({ openid: 'other_openid' });
    testDishIds = [];
    
    // 创建测试菜品
    for (let i = 0; i < 3; i++) {
      const dishId = await createTestDish(testUserId, {
        name: `测试菜品${i + 1}`,
        description: `描述${i + 1}`
      });
      testDishIds.push(dishId);
    }
    
    // 创建点餐活动
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

  afterAll(async () => {
    await cleanupTestData();
  });

  describe('创建订单', () => {
    test('成功下单', async () => {
      const event = {
        action: 'create',
        data: {
          mealId,
          dishIds: [testDishIds[0], testDishIds[1]]
        }
      };
      const context = mockContext(otherUserId);

      const result = await orderFunction.main(event, context);

      expect(result.success).toBe(true);
      expect(result.code).toBe(0);
      expect(result.data.mealId).toBe(mealId);
      expect(result.data.orders.length).toBe(2);
    });

    test('下单失败-点餐不存在', async () => {
      const event = {
        action: 'create',
        data: {
          mealId: 99999,
          dishIds: [testDishIds[0]]
        }
      };
      const context = mockContext(otherUserId);

      const result = await orderFunction.main(event, context);

      expect(result.success).toBe(false);
    });

    test('下单失败-已收单', async () => {
      // 先收单
      await mealFunction.main(
        { action: 'close', data: { id: mealId } },
        mockContext(testUserId)
      );

      const event = {
        action: 'create',
        data: {
          mealId,
          dishIds: [testDishIds[0]]
        }
      };
      const context = mockContext(otherUserId);

      const result = await orderFunction.main(event, context);

      expect(result.success).toBe(false);
    });

    test('下单失败-未选择菜品', async () => {
      const event = {
        action: 'create',
        data: {
          mealId,
          dishIds: []
        }
      };
      const context = mockContext(otherUserId);

      const result = await orderFunction.main(event, context);

      expect(result.success).toBe(false);
      expect(result.code).toBe(400);
    });

    test('重复下单会覆盖之前的订单', async () => {
      // 第一次下单
      await orderFunction.main(
        { action: 'create', data: { mealId, dishIds: [testDishIds[0]] } },
        mockContext(otherUserId)
      );

      // 第二次下单
      const event = {
        action: 'create',
        data: {
          mealId,
          dishIds: [testDishIds[1], testDishIds[2]]
        }
      };
      const context = mockContext(otherUserId);

      const result = await orderFunction.main(event, context);

      expect(result.success).toBe(true);
      expect(result.data.orders.length).toBe(2);

      // 验证之前的订单已被取消
      const myOrderResult = await orderFunction.main(
        { action: 'getMyOrder', data: { mealId } },
        mockContext(otherUserId)
      );
      expect(myOrderResult.data.dishes.length).toBe(2);
    });
  });

  describe('取消订单', () => {
    beforeEach(async () => {
      // 先下单
      await orderFunction.main(
        { action: 'create', data: { mealId, dishIds: [testDishIds[0]] } },
        mockContext(otherUserId)
      );
    });

    test('成功取消订单', async () => {
      const event = {
        action: 'cancel',
        data: {
          mealId
        }
      };
      const context = mockContext(otherUserId);

      const result = await orderFunction.main(event, context);

      expect(result.success).toBe(true);
      expect(result.code).toBe(0);

      // 验证订单已取消
      const myOrderResult = await orderFunction.main(
        { action: 'getMyOrder', data: { mealId } },
        mockContext(otherUserId)
      );
      expect(myOrderResult.data.ordered).toBe(false);
    });

    test('取消订单失败-已收单', async () => {
      // 收单
      await mealFunction.main(
        { action: 'close', data: { id: mealId } },
        mockContext(testUserId)
      );

      const event = {
        action: 'cancel',
        data: {
          mealId
        }
      };
      const context = mockContext(otherUserId);

      const result = await orderFunction.main(event, context);

      expect(result.success).toBe(false);
    });

    test('取消订单失败-没有订单', async () => {
      const thirdUserId = await createTestUser({ openid: 'third_openid' });
      
      const event = {
        action: 'cancel',
        data: {
          mealId
        }
      };
      const context = mockContext(thirdUserId);

      const result = await orderFunction.main(event, context);

      expect(result.success).toBe(false);
    });
  });

  describe('获取订单列表', () => {
    beforeEach(async () => {
      // 多个用户下单
      await orderFunction.main(
        { action: 'create', data: { mealId, dishIds: [testDishIds[0]] } },
        mockContext(otherUserId)
      );
      
      const thirdUserId = await createTestUser({ openid: 'third_openid' });
      await orderFunction.main(
        { action: 'create', data: { mealId, dishIds: [testDishIds[0], testDishIds[1]] } },
        mockContext(thirdUserId)
      );
    });

    test('成功获取点餐活动的订单统计', async () => {
      const event = {
        action: 'listByMeal',
        data: {
          mealId
        }
      };
      const context = mockContext(testUserId);

      const result = await orderFunction.main(event, context);

      expect(result.success).toBe(true);
      expect(result.code).toBe(0);
      expect(result.data.participantCount).toBe(2);
      expect(result.data.dishOrders.length).toBe(3);
      
      // 验证菜品1有2人点选
      const dish1Orders = result.data.dishOrders.find(d => d.dishId === testDishIds[0]);
      expect(dish1Orders.orderCount).toBe(2);
    });

    test('获取用户订单历史', async () => {
      const event = {
        action: 'listByUser',
        data: {}
      };
      const context = mockContext(otherUserId);

      const result = await orderFunction.main(event, context);

      expect(result.success).toBe(true);
      expect(result.code).toBe(0);
      expect(result.data.list.length).toBe(1);
      expect(result.data.list[0].dishName).toBe('测试菜品1');
    });
  });

  describe('获取我的订单', () => {
    test('已下单', async () => {
      await orderFunction.main(
        { action: 'create', data: { mealId, dishIds: [testDishIds[0], testDishIds[1]] } },
        mockContext(otherUserId)
      );

      const event = {
        action: 'getMyOrder',
        data: {
          mealId
        }
      };
      const context = mockContext(otherUserId);

      const result = await orderFunction.main(event, context);

      expect(result.success).toBe(true);
      expect(result.data.ordered).toBe(true);
      expect(result.data.dishes.length).toBe(2);
    });

    test('未下单', async () => {
      const event = {
        action: 'getMyOrder',
        data: {
          mealId
        }
      };
      const context = mockContext(otherUserId);

      const result = await orderFunction.main(event, context);

      expect(result.success).toBe(true);
      expect(result.data.ordered).toBe(false);
      expect(result.data.dishes.length).toBe(0);
    });
  });
});
