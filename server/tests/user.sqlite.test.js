/**
 * 用户管理云函数单元测试 (SQLite版本)
 * 使用内存数据库，无需外部MySQL服务
 */

const { success, error, paramError, notFound } = require('../functions/utils/response');
const {
  cleanupTestData,
  createTestUser,
  testQuery,
  mockContext,
  closeTestDB
} = require('./sqlite-setup');

// 模拟用户云函数
async function userMain(event, context) {
  const { action, data } = event;
  const userId = context.userId;

  try {
    switch (action) {
      case 'login': {
        const { code, userInfo } = data || {};

        if (!code) {
          return paramError('登录凭证不能为空');
        }

        // 实际部署时，这里需要调用微信接口获取openid
        // 目前使用模拟数据
        const mockOpenid = `mock_openid_${code}`;

        // 查询用户是否存在
        let user = testQuery(
          'SELECT id, openid, nickname, avatar_url, status FROM wte_users WHERE openid = ?',
          [mockOpenid]
        );

        if (user.length === 0) {
          // 新用户，创建用户记录
          const nickname = userInfo?.nickName || '微信用户';
          const avatarUrl = userInfo?.avatarUrl || null;

          const result = testQuery(
            'INSERT INTO wte_users (openid, nickname, avatar_url) VALUES (?, ?, ?)',
            [mockOpenid, nickname, avatarUrl]
          );

          user = testQuery(
            'SELECT id, openid, nickname, avatar_url, status FROM wte_users WHERE id = ?',
            [result.insertId]
          );

          // 自动创建默认厨房
          testQuery(
            'INSERT INTO wte_kitchens (user_id, name, description, is_default) VALUES (?, ?, ?, ?)',
            [result.insertId, '我的厨房', '默认厨房', 1]
          );
        } else {
          // 更新最后登录时间
          testQuery(
            'UPDATE wte_users SET last_login_at = CURRENT_TIMESTAMP WHERE id = ?',
            [user[0].id]
          );

          // 如果提供了新的用户信息，更新用户信息
          if (userInfo) {
            const updates = [];
            const params = [];

            if (userInfo.nickName) {
              updates.push('nickname = ?');
              params.push(userInfo.nickName);
            }

            if (userInfo.avatarUrl) {
              updates.push('avatar_url = ?');
              params.push(userInfo.avatarUrl);
            }

            if (updates.length > 0) {
              params.push(user[0].id);
              testQuery(
                `UPDATE wte_users SET ${updates.join(', ')} WHERE id = ?`,
                params
              );

              // 重新查询用户信息
              user = testQuery(
                'SELECT id, openid, nickname, avatar_url, status FROM wte_users WHERE id = ?',
                [user[0].id]
              );
            }
          }
        }

        return success({
          userId: user[0].id,
          openid: user[0].openid,
          nickname: user[0].nickname,
          avatarUrl: user[0].avatarUrl,
          status: user[0].status,
          isNewUser: user.length === 0
        }, '登录成功');
      }

      case 'update': {
        const { nickname, avatarUrl } = data || {};

        // 检查用户是否存在
        const user = testQuery(
          'SELECT id FROM wte_users WHERE id = ?',
          [userId]
        );

        if (user.length === 0) {
          return notFound('用户不存在');
        }

        const updates = [];
        const params = [];

        if (nickname !== undefined) {
          updates.push('nickname = ?');
          params.push(nickname);
        }

        if (avatarUrl !== undefined) {
          updates.push('avatar_url = ?');
          params.push(avatarUrl);
        }

        if (updates.length === 0) {
          return paramError('没有要更新的字段');
        }

        params.push(userId);
        testQuery(
          `UPDATE wte_users SET ${updates.join(', ')} WHERE id = ?`,
          params
        );

        // 返回更新后的用户信息
        const updatedUser = testQuery(
          'SELECT id, openid, nickname, avatar_url, status FROM wte_users WHERE id = ?',
          [userId]
        );

        return success({
          userId: updatedUser[0].id,
          openid: updatedUser[0].openid,
          nickname: updatedUser[0].nickname,
          avatarUrl: updatedUser[0].avatarUrl,
          status: updatedUser[0].status
        }, '用户信息更新成功');
      }

      case 'get': {
        // 获取用户信息
        const user = testQuery(
          'SELECT id, openid, nickname, avatar_url, status, created_at FROM wte_users WHERE id = ?',
          [userId]
        );

        if (user.length === 0) {
          return notFound('用户不存在');
        }

        return success({
          userId: user[0].id,
          openid: user[0].openid,
          nickname: user[0].nickname,
          avatarUrl: user[0].avatarUrl,
          status: user[0].status,
          createdAt: user[0].createdAt
        });
      }

      default:
        return paramError('未知的操作类型');
    }
  } catch (err) {
    console.error('User function error:', err);
    return error(err.message || '操作失败');
  }
}

describe('用户管理云函数测试 (SQLite)', () => {
  beforeEach(() => {
    cleanupTestData();
  });

  afterAll(() => {
    cleanupTestData();
    closeTestDB();
  });

  describe('用户登录', () => {
    test('新用户登录成功', async () => {
      const event = {
        action: 'login',
        data: {
          code: 'test_code_123',
          userInfo: {
            nickName: '测试用户',
            avatarUrl: 'https://example.com/avatar.jpg'
          }
        }
      };
      const context = mockContext(1);

      const result = await userMain(event, context);

      expect(result.success).toBe(true);
      expect(result.code).toBe(0);
      expect(result.data.nickname).toBe('测试用户');
      expect(result.data.avatarUrl).toBe('https://example.com/avatar.jpg');
      expect(result.data.userId).toBeDefined();
    });

    test('老用户登录成功', async () => {
      // 先创建用户
      const openid = 'mock_openid_existing_code';
      const result1 = testQuery(
        'INSERT INTO wte_users (openid, nickname, avatar_url) VALUES (?, ?, ?)',
        [openid, '老用户', 'https://example.com/old.jpg']
      );

      const event = {
        action: 'login',
        data: {
          code: 'existing_code',
          userInfo: {
            nickName: '更新的昵称',
            avatarUrl: 'https://example.com/new.jpg'
          }
        }
      };
      const context = mockContext(result1.insertId);

      const result = await userMain(event, context);

      expect(result.success).toBe(true);
      expect(result.data.nickname).toBe('更新的昵称');
      expect(result.data.avatarUrl).toBe('https://example.com/new.jpg');
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
      const context = mockContext(1);

      const result = await userMain(event, context);

      expect(result.success).toBe(false);
      expect(result.code).toBe(400);
    });

    test('新用户登录自动创建默认厨房', async () => {
      const event = {
        action: 'login',
        data: {
          code: 'new_user_code'
        }
      };
      const context = mockContext(1);

      const result = await userMain(event, context);

      expect(result.success).toBe(true);

      // 验证默认厨房已创建
      const kitchens = testQuery(
        'SELECT * FROM wte_kitchens WHERE user_id = ? AND is_default = 1',
        [result.data.userId]
      );
      expect(kitchens.length).toBe(1);
      expect(kitchens[0].name).toBe('我的厨房');
    });
  });

  describe('获取用户信息', () => {
    test('成功获取用户信息', async () => {
      const userId = createTestUser({
        openid: 'test_openid',
        nickname: '测试用户',
        avatarUrl: 'https://example.com/avatar.jpg'
      });

      const event = {
        action: 'get'
      };
      const context = mockContext(userId);

      const result = await userMain(event, context);

      expect(result.success).toBe(true);
      expect(result.data.nickname).toBe('测试用户');
      expect(result.data.avatarUrl).toBe('https://example.com/avatar.jpg');
    });

    test('获取用户信息失败-用户不存在', async () => {
      const event = {
        action: 'get'
      };
      const context = mockContext(99999);

      const result = await userMain(event, context);

      expect(result.success).toBe(false);
      expect(result.code).toBe(404);
    });
  });

  describe('更新用户信息', () => {
    test('成功更新昵称', async () => {
      const userId = createTestUser({
        openid: 'test_openid',
        nickname: '原昵称'
      });

      const event = {
        action: 'update',
        data: {
          nickname: '新昵称'
        }
      };
      const context = mockContext(userId);

      const result = await userMain(event, context);

      expect(result.success).toBe(true);
      expect(result.data.nickname).toBe('新昵称');
    });

    test('成功更新头像', async () => {
      const userId = createTestUser({
        openid: 'test_openid',
        avatarUrl: 'https://example.com/old.jpg'
      });

      const event = {
        action: 'update',
        data: {
          avatarUrl: 'https://example.com/new.jpg'
        }
      };
      const context = mockContext(userId);

      const result = await userMain(event, context);

      expect(result.success).toBe(true);
      expect(result.data.avatarUrl).toBe('https://example.com/new.jpg');
    });

    test('同时更新昵称和头像', async () => {
      const userId = createTestUser({
        openid: 'test_openid',
        nickname: '原昵称',
        avatarUrl: 'https://example.com/old.jpg'
      });

      const event = {
        action: 'update',
        data: {
          nickname: '新昵称',
          avatarUrl: 'https://example.com/new.jpg'
        }
      };
      const context = mockContext(userId);

      const result = await userMain(event, context);

      expect(result.success).toBe(true);
      expect(result.data.nickname).toBe('新昵称');
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

      const result = await userMain(event, context);

      expect(result.success).toBe(false);
      expect(result.code).toBe(404);
    });

    test('更新失败-没有要更新的字段', async () => {
      const userId = createTestUser({ openid: 'test_openid' });

      const event = {
        action: 'update',
        data: {}
      };
      const context = mockContext(userId);

      const result = await userMain(event, context);

      expect(result.success).toBe(false);
      expect(result.code).toBe(400);
    });
  });
});
