/**
 * 菜品管理云函数单元测试
 * 测试菜品的增删改查功能
 */

const dishFunction = require('../functions/dish/index.js');
const {
  cleanupTestData,
  createTestUser,
  testQuery,
  mockContext
} = require('./setup');

describe('菜品管理云函数测试', () => {
  let testUserId;
  let testKitchenId;

  beforeEach(async () => {
    await cleanupTestData();
    testUserId = await createTestUser();
    // 获取默认厨房ID
    const kitchens = await testQuery(
      'SELECT id FROM wte_kitchens WHERE user_id = ? AND is_default = 1',
      [testUserId]
    );
    testKitchenId = kitchens[0]?.id;
  });

  afterAll(async () => {
    await cleanupTestData();
  });

  describe('创建菜品', () => {
    test('成功创建菜品', async () => {
      const event = {
        action: 'create',
        data: {
          name: '宫保鸡丁',
          description: '经典川菜'
        }
      };
      const context = mockContext(testUserId);

      const result = await dishFunction.main(event, context);

      expect(result.success).toBe(true);
      expect(result.code).toBe(0);
      expect(result.data.name).toBe('宫保鸡丁');
      expect(result.data.description).toBe('经典川菜');
      expect(result.data.id).toBeDefined();
    });

    test('创建菜品失败-名称为空', async () => {
      const event = {
        action: 'create',
        data: {
          name: '',
          description: '描述'
        }
      };
      const context = mockContext(testUserId);

      const result = await dishFunction.main(event, context);

      expect(result.success).toBe(false);
      expect(result.code).toBe(400);
    });

    test('创建菜品失败-名称为null', async () => {
      const event = {
        action: 'create',
        data: {
          description: '描述'
        }
      };
      const context = mockContext(testUserId);

      const result = await dishFunction.main(event, context);

      expect(result.success).toBe(false);
      expect(result.code).toBe(400);
    });

    test('创建菜品失败-重复名称', async () => {
      // 先创建一个菜品
      const event1 = {
        action: 'create',
        data: {
          name: '宫保鸡丁',
          description: '描述1'
        }
      };
      const context = mockContext(testUserId);
      await dishFunction.main(event1, context);

      // 再创建同名菜品
      const event2 = {
        action: 'create',
        data: {
          name: '宫保鸡丁',
          description: '描述2'
        }
      };

      const result = await dishFunction.main(event2, context);

      expect(result.success).toBe(false);
      expect(result.code).toBe(-1);
    });

    test('成功创建同名菜品-不同用户', async () => {
      const otherUserId = await createTestUser({ openid: 'other_openid' });

      // 用户1创建菜品
      const event1 = {
        action: 'create',
        data: {
          name: '宫保鸡丁',
          description: '描述1'
        }
      };
      await dishFunction.main(event1, mockContext(testUserId));

      // 用户2创建同名菜品
      const event2 = {
        action: 'create',
        data: {
          name: '宫保鸡丁',
          description: '描述2'
        }
      };
      const result = await dishFunction.main(event2, mockContext(otherUserId));

      expect(result.success).toBe(true);
      expect(result.code).toBe(0);
    });
  });

  describe('更新菜品', () => {
    let dishId;

    beforeEach(async () => {
      // 先创建一个菜品
      const createEvent = {
        action: 'create',
        data: {
          name: '宫保鸡丁',
          description: '经典川菜'
        }
      };
      const result = await dishFunction.main(createEvent, mockContext(testUserId));
      dishId = result.data.id;
    });

    test('成功更新菜品', async () => {
      const event = {
        action: 'update',
        data: {
          id: dishId,
          name: '宫保鸡丁（改良版）',
          description: '改良后的川菜'
        }
      };
      const context = mockContext(testUserId);

      const result = await dishFunction.main(event, context);

      expect(result.success).toBe(true);
      expect(result.code).toBe(0);
      expect(result.data.name).toBe('宫保鸡丁（改良版）');
      expect(result.data.description).toBe('改良后的川菜');
    });

    test('更新菜品失败-菜品不存在', async () => {
      const event = {
        action: 'update',
        data: {
          id: 99999,
          name: '不存在',
          description: '描述'
        }
      };
      const context = mockContext(testUserId);

      const result = await dishFunction.main(event, context);

      expect(result.success).toBe(false);
      expect(result.code).toBe(404);
    });

    test('更新菜品失败-无权操作', async () => {
      const otherUserId = await createTestUser({ openid: 'other_openid' });

      const event = {
        action: 'update',
        data: {
          id: dishId,
          name: '新名称',
          description: '新描述'
        }
      };
      const context = mockContext(otherUserId);

      const result = await dishFunction.main(event, context);

      expect(result.success).toBe(false);
      expect(result.code).toBe(404);
    });
  });

  describe('删除菜品', () => {
    let dishId;

    beforeEach(async () => {
      const createEvent = {
        action: 'create',
        data: {
          name: '测试菜品',
          description: '测试描述'
        }
      };
      const result = await dishFunction.main(createEvent, mockContext(testUserId));
      dishId = result.data.id;
    });

    test('成功删除菜品', async () => {
      const event = {
        action: 'delete',
        data: {
          id: dishId
        }
      };
      const context = mockContext(testUserId);

      const result = await dishFunction.main(event, context);

      expect(result.success).toBe(true);
      expect(result.code).toBe(0);

      // 验证菜品已被删除
      const getEvent = {
        action: 'get',
        data: {
          id: dishId
        }
      };
      const getResult = await dishFunction.main(getEvent, context);
      expect(getResult.code).toBe(404);
    });

    test('删除菜品失败-菜品不存在', async () => {
      const event = {
        action: 'delete',
        data: {
          id: 99999
        }
      };
      const context = mockContext(testUserId);

      const result = await dishFunction.main(event, context);

      expect(result.success).toBe(false);
      expect(result.code).toBe(404);
    });
  });

  describe('获取菜品列表', () => {
    beforeEach(async () => {
      // 创建多个菜品
      const dishes = ['宫保鸡丁', '鱼香肉丝', '糖醋排骨'];
      for (const name of dishes) {
        const event = {
          action: 'create',
          data: {
            name,
            description: `${name}的描述`
          }
        };
        await dishFunction.main(event, mockContext(testUserId));
      }
    });

    test('成功获取菜品列表', async () => {
      const event = {
        action: 'list',
        data: {}
      };
      const context = mockContext(testUserId);

      const result = await dishFunction.main(event, context);

      expect(result.success).toBe(true);
      expect(result.code).toBe(0);
      expect(result.data.list.length).toBe(3);
      expect(result.data.total).toBe(3);
    });

    test('成功搜索菜品', async () => {
      const event = {
        action: 'list',
        data: {
          keyword: '鸡丁'
        }
      };
      const context = mockContext(testUserId);

      const result = await dishFunction.main(event, context);

      expect(result.success).toBe(true);
      expect(result.code).toBe(0);
      expect(result.data.list.length).toBe(1);
      expect(result.data.list[0].name).toBe('宫保鸡丁');
    });

    test('搜索无结果', async () => {
      const event = {
        action: 'list',
        data: {
          keyword: '不存在'
        }
      };
      const context = mockContext(testUserId);

      const result = await dishFunction.main(event, context);

      expect(result.success).toBe(true);
      expect(result.code).toBe(0);
      expect(result.data.list.length).toBe(0);
    });
  });

  describe('获取单个菜品', () => {
    let dishId;

    beforeEach(async () => {
      const createEvent = {
        action: 'create',
        data: {
          name: '测试菜品',
          description: '测试描述'
        }
      };
      const result = await dishFunction.main(createEvent, mockContext(testUserId));
      dishId = result.data.id;
    });

    test('成功获取菜品详情', async () => {
      const event = {
        action: 'get',
        data: {
          id: dishId
        }
      };
      const context = mockContext(testUserId);

      const result = await dishFunction.main(event, context);

      expect(result.success).toBe(true);
      expect(result.code).toBe(0);
      expect(result.data.id).toBe(dishId);
      expect(result.data.name).toBe('测试菜品');
    });

    test('获取菜品失败-不存在', async () => {
      const event = {
        action: 'get',
        data: {
          id: 99999
        }
      };
      const context = mockContext(testUserId);

      const result = await dishFunction.main(event, context);

      expect(result.success).toBe(false);
      expect(result.code).toBe(404);
    });
  });
});
