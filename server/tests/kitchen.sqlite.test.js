/**
 * 厨房管理云函数 - SQLite 单元测试
 */

const Database = require('better-sqlite3');

// 初始化测试数据库
function initTestDb() {
  const db = new Database(':memory:');

  // 创建厨房表
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

  return db;
}

// 先定义 mock 函数
let mockDb;
const mockQuery = jest.fn();
const mockGetUserId = jest.fn();

// 模拟 db 模块
jest.mock('../functions/kitchen/utils/db', () => {
  return {
    query: mockQuery,
    getUserId: mockGetUserId
  };
});

// 模拟 response 模块
jest.mock('../functions/kitchen/utils/response', () => {
  return {
    success: (data, message) => ({ code: 0, message, data, success: true }),
    error: (message, code = -1) => ({ code, message, data: null, success: false }),
    paramError: (message = '参数错误') => ({ code: 400, message, data: null, success: false }),
    notFound: (message = '资源不存在') => ({ code: 404, message, data: null, success: false })
  };
});

// 导入被测试的函数（在 mock 之后）
const kitchenModule = require('../functions/kitchen/index.js');

describe('厨房管理云函数测试', () => {
  const TEST_USER_ID = 'test_user_001';

  beforeEach(() => {
    // 初始化内存数据库
    mockDb = initTestDb();
    mockGetUserId.mockReturnValue(TEST_USER_ID);

    // 模拟 query 函数
    mockQuery.mockImplementation((sql, params = []) => {
      // 处理 INSERT - 返回 MySQL 格式的对象
      if (sql.includes('INSERT INTO wte_kitchens')) {
        const stmt = mockDb.prepare(sql);
        const result = stmt.run(...params);
        return {
          insertId: Number(result.lastInsertRowid),
          affectedRows: result.changes
        };
      }

      // 处理 SELECT - 返回数组
      if (sql.includes('SELECT')) {
        const stmt = mockDb.prepare(sql);
        return stmt.all(...params);
      }

      // 处理 UPDATE - 返回 MySQL 格式的对象
      if (sql.includes('UPDATE wte_kitchens')) {
        const stmt = mockDb.prepare(sql);
        const result = stmt.run(...params);
        return {
          affectedRows: result.changes
        };
      }

      return [];
    });
  });

  afterEach(() => {
    if (mockDb) {
      mockDb.close();
    }
    mockQuery.mockClear();
    mockGetUserId.mockClear();
  });

  describe('createKitchen', () => {
    it('应该成功创建厨房', async () => {
      const result = await kitchenModule.main(
        { action: 'create', data: { name: '我的测试厨房' } },
        {}
      );

      expect(result.success).toBe(true);
      expect(result.data.name).toBe('我的测试厨房');
      expect(result.data.is_default).toBe(1); // 第一个厨房是默认
    });

    it('应该拒绝空名称', async () => {
      const result = await kitchenModule.main(
        { action: 'create', data: { name: '' } },
        {}
      );

      expect(result.success).toBe(false);
      expect(result.code).toBe(400);
    });

    it('应该拒绝重复名称', async () => {
      // 先创建一个厨房
      await kitchenModule.main(
        { action: 'create', data: { name: '测试厨房' } },
        {}
      );

      // 再创建同名厨房
      const result = await kitchenModule.main(
        { action: 'create', data: { name: '测试厨房' } },
        {}
      );

      expect(result.success).toBe(false);
    });
  });

  describe('listKitchens', () => {
    it('应该返回厨房列表', async () => {
      // 创建测试数据
      await kitchenModule.main(
        { action: 'create', data: { name: '厨房A' } },
        {}
      );
      await kitchenModule.main(
        { action: 'create', data: { name: '厨房B' } },
        {}
      );

      const result = await kitchenModule.main(
        { action: 'list' },
        {}
      );

      expect(result.success).toBe(true);
      expect(result.data.list.length).toBe(2);
    });
  });

  describe('updateKitchen', () => {
    it('应该成功更新厨房名称', async () => {
      // 先创建厨房
      const createResult = await kitchenModule.main(
        { action: 'create', data: { name: '原名称' } },
        {}
      );
      const kitchenId = createResult.data.id;

      const result = await kitchenModule.main(
        { action: 'update', data: { id: kitchenId, name: '新名称' } },
        {}
      );

      expect(result.success).toBe(true);
      expect(result.data.name).toBe('新名称');
    });

    it('应该拒绝不存在的厨房', async () => {
      const result = await kitchenModule.main(
        { action: 'update', data: { id: 99999, name: '新名称' } },
        {}
      );

      expect(result.success).toBe(false);
      expect(result.code).toBe(404);
    });
  });

  describe('deleteKitchen', () => {
    it('应该成功删除非默认厨房', async () => {
      // 创建两个厨房
      await kitchenModule.main(
        { action: 'create', data: { name: '厨房A' } },
        {}
      );
      const resultB = await kitchenModule.main(
        { action: 'create', data: { name: '厨房B' } },
        {}
      );

      // 将第二个设为默认
      await kitchenModule.main(
        { action: 'setDefault', data: { id: resultB.data.id } },
        {}
      );

      // 创建第三个厨房并删除
      const resultC = await kitchenModule.main(
        { action: 'create', data: { name: '厨房C' } },
        {}
      );

      const deleteResult = await kitchenModule.main(
        { action: 'delete', data: { id: resultC.data.id } },
        {}
      );

      expect(deleteResult.success).toBe(true);
    });

    it('应该拒绝删除默认厨房', async () => {
      // 创建厨房并设为默认
      const result = await kitchenModule.main(
        { action: 'create', data: { name: '厨房A' } },
        {}
      );
      const kitchenId = result.data.id;

      await kitchenModule.main(
        { action: 'setDefault', data: { id: kitchenId } },
        {}
      );

      const deleteResult = await kitchenModule.main(
        { action: 'delete', data: { id: kitchenId } },
        {}
      );

      expect(deleteResult.success).toBe(false);
    });
  });

  describe('setDefaultKitchen', () => {
    it('应该成功设置默认厨房', async () => {
      // 创建两个厨房
      await kitchenModule.main(
        { action: 'create', data: { name: '厨房A' } },
        {}
      );
      const resultB = await kitchenModule.main(
        { action: 'create', data: { name: '厨房B' } },
        {}
      );

      const result = await kitchenModule.main(
        { action: 'setDefault', data: { id: resultB.data.id } },
        {}
      );

      expect(result.success).toBe(true);
      expect(result.data.is_default).toBe(1);
    });
  });
});
