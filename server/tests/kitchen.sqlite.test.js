/**
 * 厨房管理云函数 - SQLite 单元测试
 */

const Database = require('better-sqlite3');

function initTestDb() {
  const db = new Database(':memory:');

  db.exec(`
    CREATE TABLE wte_kitchens (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT NOT NULL,
      name TEXT NOT NULL,
      is_default INTEGER DEFAULT 0,
      status INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  db.exec(`
    CREATE TABLE wte_kitchen_members (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      kitchen_id INTEGER NOT NULL,
      user_id TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'admin',
      status INTEGER DEFAULT 1,
      invited_by TEXT DEFAULT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(kitchen_id, user_id)
    )
  `);

  db.exec(`
    CREATE TABLE wte_kitchen_invites (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      kitchen_id INTEGER NOT NULL,
      user_id TEXT NOT NULL,
      token TEXT NOT NULL UNIQUE,
      expires_at DATETIME NOT NULL,
      status INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  db.exec(`
    CREATE TABLE wte_users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      openid TEXT,
      nickname TEXT DEFAULT '微信用户',
      avatar_url TEXT DEFAULT '',
      status INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  return db;
}

let mockDb;
const mockQuery = jest.fn();
const mockGetUserId = jest.fn();

jest.mock('../functions/kitchen/utils/db', () => {
  return {
    query: mockQuery,
    getUserId: mockGetUserId
  };
});

jest.mock('../functions/kitchen/utils/response', () => {
  return {
    success: (data, message) => ({ code: 0, message, data, success: true }),
    error: (message, code = -1) => ({ code, message, data: null, success: false }),
    paramError: (message = '参数错误') => ({ code: 400, message, data: null, success: false }),
    notFound: (message = '资源不存在') => ({ code: 404, message, data: null, success: false })
  };
});

const kitchenModule = require('../functions/kitchen/index.js');

describe('厨房管理云函数测试', () => {
  const TEST_USER_ID = 1;
  const TEST_USER_ID_2 = 2;

  beforeEach(() => {
    mockDb = initTestDb();
    mockGetUserId.mockReturnValue(TEST_USER_ID);

    mockDb.prepare('INSERT INTO wte_users (id, nickname) VALUES (?, ?)').run(TEST_USER_ID, '测试用户A');
    mockDb.prepare('INSERT INTO wte_users (id, nickname) VALUES (?, ?)').run(TEST_USER_ID_2, '测试用户B');

    mockQuery.mockImplementation((sql, params = []) => {
      // Handle INSERT ... ON DUPLICATE KEY UPDATE (SQLite doesn't support this)
      if (sql.includes('ON DUPLICATE KEY UPDATE')) {
        const cleanSql = sql.replace(/ON DUPLICATE KEY UPDATE.*$/i, '').trim();
        try {
          const stmt = mockDb.prepare(cleanSql);
          const result = stmt.run(...params);
          return { insertId: Number(result.lastInsertRowid), affectedRows: result.changes };
        } catch (e) {
          if (e.message.includes('UNIQUE constraint failed')) {
            // Simulate the UPDATE part
            const updateMatch = sql.match(/ON DUPLICATE KEY UPDATE (.+)$/i);
            if (updateMatch) {
              return { insertId: 0, affectedRows: 0 };
            }
          }
          throw e;
        }
      }

      // Handle DATE_ADD for SQLite
      let adaptedSql = sql;
      if (sql.includes('DATE_ADD(NOW(), INTERVAL 7 DAY)')) {
        adaptedSql = sql.replace("DATE_ADD(NOW(), INTERVAL 7 DAY)", "datetime('now', '+7 days')");
      }
      if (adaptedSql.includes('NOW()')) {
        adaptedSql = adaptedSql.replace(/NOW\(\)/g, "datetime('now')");
      }

      if (adaptedSql.includes('INSERT')) {
        const stmt = mockDb.prepare(adaptedSql);
        const result = stmt.run(...params);
        return { insertId: Number(result.lastInsertRowid), affectedRows: result.changes };
      }

      if (adaptedSql.includes('SELECT')) {
        // Handle MySQL's role = 'owner' DESC expression for SQLite
        adaptedSql = adaptedSql.replace(/km\.role = 'owner' DESC/g, "CASE WHEN km.role = 'owner' THEN 0 ELSE 1 END ASC");
        const stmt = mockDb.prepare(adaptedSql);
        return stmt.all(...params);
      }

      if (adaptedSql.includes('UPDATE')) {
        const stmt = mockDb.prepare(adaptedSql);
        const result = stmt.run(...params);
        return { affectedRows: result.changes };
      }

      return [];
    });
  });

  afterEach(() => {
    if (mockDb) mockDb.close();
    mockQuery.mockClear();
    mockGetUserId.mockClear();
  });

  // ============= Original CRUD Tests =============

  describe('createKitchen', () => {
    it('应该成功创建厨房并插入 owner 成员记录', async () => {
      const result = await kitchenModule.main(
        { action: 'create', data: { name: '我的测试厨房' } }, {}
      );

      expect(result.success).toBe(true);
      expect(result.data.name).toBe('我的测试厨房');
      expect(result.data.is_default).toBe(1);

      // Verify owner member record
      const members = mockDb.prepare('SELECT * FROM wte_kitchen_members WHERE kitchen_id = ?').all(result.data.id);
      expect(members.length).toBe(1);
      expect(members[0].role).toBe('owner');
      expect(Number(members[0].user_id)).toBe(TEST_USER_ID);
    });

    it('应该拒绝空名称', async () => {
      const result = await kitchenModule.main(
        { action: 'create', data: { name: '' } }, {}
      );
      expect(result.success).toBe(false);
      expect(result.code).toBe(400);
    });

    it('应该拒绝重复名称', async () => {
      await kitchenModule.main({ action: 'create', data: { name: '测试厨房' } }, {});
      const result = await kitchenModule.main({ action: 'create', data: { name: '测试厨房' } }, {});
      expect(result.success).toBe(false);
    });
  });

  describe('listKitchens', () => {
    it('应该返回厨房列表', async () => {
      await kitchenModule.main({ action: 'create', data: { name: '厨房A' } }, {});
      await kitchenModule.main({ action: 'create', data: { name: '厨房B' } }, {});

      const result = await kitchenModule.main({ action: 'list' }, {});
      expect(result.success).toBe(true);
      expect(result.data.list.length).toBe(2);
    });
  });

  describe('updateKitchen', () => {
    it('应该成功更新厨房名称', async () => {
      const createResult = await kitchenModule.main(
        { action: 'create', data: { name: '原名称' } }, {}
      );
      const result = await kitchenModule.main(
        { action: 'update', data: { id: createResult.data.id, name: '新名称' } }, {}
      );
      expect(result.success).toBe(true);
      expect(result.data.name).toBe('新名称');
    });

    it('应该拒绝不存在的厨房', async () => {
      const result = await kitchenModule.main(
        { action: 'update', data: { id: 99999, name: '新名称' } }, {}
      );
      expect(result.success).toBe(false);
      expect(result.code).toBe(404);
    });
  });

  describe('deleteKitchen', () => {
    it('应该成功删除非默认厨房', async () => {
      await kitchenModule.main({ action: 'create', data: { name: '厨房A' } }, {});
      const resultB = await kitchenModule.main({ action: 'create', data: { name: '厨房B' } }, {});
      await kitchenModule.main({ action: 'setDefault', data: { id: resultB.data.id } }, {});
      const resultC = await kitchenModule.main({ action: 'create', data: { name: '厨房C' } }, {});

      const deleteResult = await kitchenModule.main(
        { action: 'delete', data: { id: resultC.data.id } }, {}
      );
      expect(deleteResult.success).toBe(true);
    });

    it('应该拒绝删除默认厨房', async () => {
      const result = await kitchenModule.main({ action: 'create', data: { name: '厨房A' } }, {});
      await kitchenModule.main({ action: 'setDefault', data: { id: result.data.id } }, {});
      const deleteResult = await kitchenModule.main(
        { action: 'delete', data: { id: result.data.id } }, {}
      );
      expect(deleteResult.success).toBe(false);
    });
  });

  describe('setDefaultKitchen', () => {
    it('应该成功设置默认厨房', async () => {
      await kitchenModule.main({ action: 'create', data: { name: '厨房A' } }, {});
      const resultB = await kitchenModule.main({ action: 'create', data: { name: '厨房B' } }, {});

      const result = await kitchenModule.main(
        { action: 'setDefault', data: { id: resultB.data.id } }, {}
      );
      expect(result.success).toBe(true);
      expect(result.data.is_default).toBe(1);
    });
  });

  describe('getOrCreateDefaultKitchen', () => {
    it('应该创建默认厨房并插入 owner 成员记录', async () => {
      const result = await kitchenModule.main({ action: 'getOrCreateDefault' }, {});
      expect(result.success).toBe(true);
      expect(result.data.name).toBe('我的厨房');

      const members = mockDb.prepare('SELECT * FROM wte_kitchen_members WHERE kitchen_id = ?').all(result.data.id);
      expect(members.length).toBe(1);
      expect(members[0].role).toBe('owner');
    });
  });

  // ============= New Member Management Tests =============

  describe('listAccessibleKitchens', () => {
    it('应该返回用户拥有的厨房', async () => {
      await kitchenModule.main({ action: 'create', data: { name: '我的厨房' } }, {});

      const result = await kitchenModule.main({ action: 'listAccessible' }, {});
      expect(result.success).toBe(true);
      expect(result.data.list.length).toBe(1);
      expect(result.data.list[0].role).toBe('owner');
      expect(result.data.list[0].ownerName).toBe('测试用户A');
    });

    it('应该返回用户作为 admin 加入的厨房', async () => {
      // User1 creates a kitchen
      const kitchen = await kitchenModule.main({ action: 'create', data: { name: '用户A的厨房' } }, {});

      // Directly insert User2 as admin
      mockDb.prepare(
        "INSERT INTO wte_kitchen_members (kitchen_id, user_id, role, status) VALUES (?, ?, 'admin', 1)"
      ).run(kitchen.data.id, TEST_USER_ID_2);

      // Switch to User2
      mockGetUserId.mockReturnValue(TEST_USER_ID_2);

      const result = await kitchenModule.main({ action: 'listAccessible' }, {});
      expect(result.success).toBe(true);
      const adminKitchen = result.data.list.find(k => k.role === 'admin');
      expect(adminKitchen).toBeDefined();
      expect(adminKitchen.name).toBe('用户A的厨房');
    });
  });

  describe('listMembers', () => {
    it('owner 应该能查看成员列表', async () => {
      const kitchen = await kitchenModule.main({ action: 'create', data: { name: '测试厨房' } }, {});

      // Add an admin
      mockDb.prepare(
        "INSERT INTO wte_kitchen_members (kitchen_id, user_id, role, status, invited_by) VALUES (?, ?, 'admin', 1, ?)"
      ).run(kitchen.data.id, TEST_USER_ID_2, TEST_USER_ID);

      const result = await kitchenModule.main(
        { action: 'listMembers', data: { kitchenId: kitchen.data.id } }, {}
      );
      expect(result.success).toBe(true);
      expect(result.data.list.length).toBe(1);
      expect(result.data.list[0].nickname).toBe('测试用户B');
    });

    it('非 owner 不能查看成员列表', async () => {
      const kitchen = await kitchenModule.main({ action: 'create', data: { name: '测试厨房' } }, {});
      mockGetUserId.mockReturnValue(TEST_USER_ID_2);

      const result = await kitchenModule.main(
        { action: 'listMembers', data: { kitchenId: kitchen.data.id } }, {}
      );
      expect(result.success).toBe(false);
    });
  });

  describe('removeMember', () => {
    it('owner 应该能移除 admin', async () => {
      const kitchen = await kitchenModule.main({ action: 'create', data: { name: '测试厨房' } }, {});
      const memberInsert = mockDb.prepare(
        "INSERT INTO wte_kitchen_members (kitchen_id, user_id, role, status) VALUES (?, ?, 'admin', 1)"
      ).run(kitchen.data.id, TEST_USER_ID_2);

      const result = await kitchenModule.main(
        { action: 'removeMember', data: { kitchenId: kitchen.data.id, memberId: Number(memberInsert.lastInsertRowid) } }, {}
      );
      expect(result.success).toBe(true);

      // Verify member is deactivated
      const member = mockDb.prepare('SELECT status FROM wte_kitchen_members WHERE id = ?')
        .get(Number(memberInsert.lastInsertRowid));
      expect(member.status).toBe(0);
    });
  });

  describe('leaveKitchen', () => {
    it('admin 应该能退出厨房', async () => {
      const kitchen = await kitchenModule.main({ action: 'create', data: { name: '测试厨房' } }, {});
      mockDb.prepare(
        "INSERT INTO wte_kitchen_members (kitchen_id, user_id, role, status) VALUES (?, ?, 'admin', 1)"
      ).run(kitchen.data.id, TEST_USER_ID_2);

      mockGetUserId.mockReturnValue(TEST_USER_ID_2);
      const result = await kitchenModule.main(
        { action: 'leaveKitchen', data: { kitchenId: kitchen.data.id } }, {}
      );
      expect(result.success).toBe(true);
    });

    it('owner 不能退出自己的厨房', async () => {
      const kitchen = await kitchenModule.main({ action: 'create', data: { name: '测试厨房' } }, {});

      const result = await kitchenModule.main(
        { action: 'leaveKitchen', data: { kitchenId: kitchen.data.id } }, {}
      );
      expect(result.success).toBe(false);
    });
  });

  describe('generateInvite + getInviteInfo + acceptInvite', () => {
    it('完整的邀请流程', async () => {
      // Owner creates kitchen and generates invite
      const kitchen = await kitchenModule.main({ action: 'create', data: { name: '测试厨房' } }, {});

      const inviteResult = await kitchenModule.main(
        { action: 'generateInvite', data: { kitchenId: kitchen.data.id } }, {}
      );
      expect(inviteResult.success).toBe(true);
      expect(inviteResult.data.token).toBeTruthy();

      const token = inviteResult.data.token;

      // User2 gets invite info
      mockGetUserId.mockReturnValue(TEST_USER_ID_2);
      const infoResult = await kitchenModule.main(
        { action: 'getInviteInfo', data: { token } }, {}
      );
      expect(infoResult.success).toBe(true);
      expect(infoResult.data.kitchenName).toBe('测试厨房');
      expect(infoResult.data.isAlreadyMember).toBe(false);

      // User2 accepts invite
      const acceptResult = await kitchenModule.main(
        { action: 'acceptInvite', data: { token } }, {}
      );
      expect(acceptResult.success).toBe(true);
      expect(acceptResult.data.kitchenName).toBe('测试厨房');

      // Verify membership
      const membership = mockDb.prepare(
        'SELECT role FROM wte_kitchen_members WHERE kitchen_id = ? AND user_id = ? AND status = 1'
      ).get(kitchen.data.id, TEST_USER_ID_2);
      expect(membership.role).toBe('admin');
    });

    it('重复生成邀请应复用已有令牌', async () => {
      const kitchen = await kitchenModule.main({ action: 'create', data: { name: '测试厨房' } }, {});

      const invite1 = await kitchenModule.main(
        { action: 'generateInvite', data: { kitchenId: kitchen.data.id } }, {}
      );
      const invite2 = await kitchenModule.main(
        { action: 'generateInvite', data: { kitchenId: kitchen.data.id } }, {}
      );
      expect(invite1.data.token).toBe(invite2.data.token);
    });

    it('已是成员时接受邀请应返回成功但不重复添加', async () => {
      const kitchen = await kitchenModule.main({ action: 'create', data: { name: '测试厨房' } }, {});
      const inviteResult = await kitchenModule.main(
        { action: 'generateInvite', data: { kitchenId: kitchen.data.id } }, {}
      );

      // User2 accepts
      mockGetUserId.mockReturnValue(TEST_USER_ID_2);
      await kitchenModule.main({ action: 'acceptInvite', data: { token: inviteResult.data.token } }, {});

      // User2 accepts again
      const secondAccept = await kitchenModule.main(
        { action: 'acceptInvite', data: { token: inviteResult.data.token } }, {}
      );
      expect(secondAccept.success).toBe(true);

      // Should still be only one member record
      const members = mockDb.prepare(
        'SELECT * FROM wte_kitchen_members WHERE kitchen_id = ? AND user_id = ?'
      ).all(kitchen.data.id, TEST_USER_ID_2);
      expect(members.length).toBe(1);
    });

    it('非 owner 不能生成邀请', async () => {
      const kitchen = await kitchenModule.main({ action: 'create', data: { name: '测试厨房' } }, {});
      mockGetUserId.mockReturnValue(TEST_USER_ID_2);

      const result = await kitchenModule.main(
        { action: 'generateInvite', data: { kitchenId: kitchen.data.id } }, {}
      );
      expect(result.success).toBe(false);
    });
  });
});
