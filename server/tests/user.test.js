/**
 * 用户管理云函数单元测试
 * 测试用户登录、注册、信息更新等功能
 */

const userFunction = require('../functions/user/index.js');
const {
  cleanupTestData,
  createTestUser,
  mockContext
} = require('./setup');

describe('用户管理云函数测试', () => {
  beforeEach(async () => {
    await cleanupTestData();
  });

  afterAll(async () => {
    await cleanupTestData();
  });

  describe('用户登录', () => {
    test('新用户登录-自动注册', async () => {
      const event = {
        action: 'login',
        data: {
          code: 'test_code_' + Date.now(),
          userInfo: {
            nickName: '测试用户',
            avatarUrl: 'https://example.com/avatar.jpg'
          }
        }
      };
      const context = mockContext();

      const result = await userFunction.main(event, context);

      expect(result.success).toBe(true);
      expect(result.code).toBe(0);
      expect(result.data.nickname).toBe('测试用户');
      expect(result.data.avatarUrl).toBe('https://example.com/avatar.jpg');
      expect(result.data.id).toBeDefined();
    });

    test('已有用户登录', async () => {
      const code = 'test_code_' + Date.now();
      
      // 第一次登录
      const event1 = {
        action: 'login',
        data: {
          code,
          userInfo: {
            nickName: '测试用户',
            avatarUrl: 'https://example.com/avatar.jpg'
          }
        }
      };
      const result1 = await userFunction.main(event1, mockContext());
      const userId = result1.data.id;

      // 第二次登录
      const event2 = {
        action: 'login',
        data: {
          code,
          userInfo: {
            nickName: '更新后的昵称',
            avatarUrl: 'https://example.com/new-avatar.jpg'
          }
        }
      };
      const result2 = await userFunction.main(event2, mockContext());

      expect(result2.success).toBe(true);
      expect(result2.data.id).toBe(userId);
      expect(result2.data.nickname).toBe('更新后的昵称');
    });

    test('登录失败-缺少code', async () => {
      const event = {
        action: 'login',
        data: {
          userInfo: {
            nickName: '测试用户'
          }
        }
      };
      const context = mockContext();

      const result = await userFunction.main(event, context);

      expect(result.success).toBe(false);
      expect(result.code).toBe(400);
    });

    test('默认昵称为微信用户', async () => {
      const event = {
        action: 'login',
        data: {
          code: 'test_code_' + Date.now()
        }
      };
      const context = mockContext();

      const result = await userFunction.main(event, context);

      expect(result.success).toBe(true);
      expect(result.data.nickname).toBe('微信用户');
    });
  });

  describe('更新用户信息', () => {
    let testUserId;

    beforeEach(async () => {
      testUserId = await createTestUser({
        nickname: '原昵称',
        avatarUrl: 'https://example.com/old.jpg'
      });
    });

    test('成功更新昵称', async () => {
      const event = {
        action: 'update',
        data: {
          nickname: '新昵称'
        }
      };
      const context = mockContext(testUserId);

      const result = await userFunction.main(event, context);

      expect(result.success).toBe(true);
      expect(result.code).toBe(0);
      expect(result.data.nickname).toBe('新昵称');
    });

    test('成功更新头像', async () => {
      const event = {
        action: 'update',
        data: {
          avatarUrl: 'https://example.com/new.jpg'
        }
      };
      const context = mockContext(testUserId);

      const result = await userFunction.main(event, context);

      expect(result.success).toBe(true);
      expect(result.data.avatarUrl).toBe('https://example.com/new.jpg');
    });

    test('更新失败-用户不存在', async () => {
      const event = {
        action: 'update',
        data: {
          nickname: '新昵称'
        }
      };
      const context = mockContext(99999);

      const result = await userFunction.main(event, context);

      expect(result.success).toBe(false);
      expect(result.code).toBe(404);
    });

    test('更新失败-没有要更新的字段', async () => {
      const event = {
        action: 'update',
        data: {}
      };
      const context = mockContext(testUserId);

      const result = await userFunction.main(event, context);

      expect(result.success).toBe(false);
      expect(result.code).toBe(400);
    });
  });

  describe('获取用户信息', () => {
    let testUserId;

    beforeEach(async () => {
      testUserId = await createTestUser({
        nickname: '测试用户',
        avatarUrl: 'https://example.com/avatar.jpg'
      });
    });

    test('成功获取用户信息', async () => {
      const event = {
        action: 'get',
        data: {}
      };
      const context = mockContext(testUserId);

      const result = await userFunction.main(event, context);

      expect(result.success).toBe(true);
      expect(result.code).toBe(0);
      expect(result.data.id).toBe(testUserId);
      expect(result.data.nickname).toBe('测试用户');
      expect(result.data.avatarUrl).toBe('https://example.com/avatar.jpg');
      expect(result.data.status).toBe(1);
    });

    test('获取失败-用户不存在', async () => {
      const event = {
        action: 'get',
        data: {}
      };
      const context = mockContext(99999);

      const result = await userFunction.main(event, context);

      expect(result.success).toBe(false);
      expect(result.code).toBe(404);
    });
  });
});
