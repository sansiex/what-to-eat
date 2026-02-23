/**
 * 菜品管理云函数单元测试 (SQLite版本)
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

// 模拟菜品云函数
async function dishMain(event, context) {
  const { action, data } = event;
  const userId = context.userId;
  
  try {
    switch (action) {
      case 'create': {
        const { name, description } = data || {};
        
        if (!name || name.trim() === '') {
          return paramError('菜品名称不能为空');
        }
        
        const trimmedName = name.trim();
        const trimmedDesc = description ? description.trim() : null;
        
        // 获取默认厨房
        const kitchens = testQuery(
          'SELECT id FROM wte_kitchens WHERE user_id = ? AND is_default = 1 AND status = 1',
          [userId]
        );
        
        if (kitchens.length === 0) {
          return error('未找到默认厨房');
        }
        
        const kitchenId = kitchens[0].id;
        
        // 检查是否已存在同名菜品
        const existingDishes = testQuery(
          'SELECT id FROM wte_dishes WHERE user_id = ? AND kitchen_id = ? AND name = ? AND status = 1',
          [userId, kitchenId, trimmedName]
        );
        
        if (existingDishes.length > 0) {
          return error('该菜品名称已存在');
        }
        
        // 插入新菜品
        const result = testQuery(
          'INSERT INTO wte_dishes (user_id, kitchen_id, name, description) VALUES (?, ?, ?, ?)',
          [userId, kitchenId, trimmedName, trimmedDesc]
        );
        
        const newDish = testQuery(
          'SELECT id, name, description, created_at FROM wte_dishes WHERE id = ?',
          [result.insertId]
        );
        
        return success(newDish[0], '菜品创建成功');
      }
      
      case 'list': {
        const { keyword, page = 1, pageSize = 100 } = data || {};
        
        // 获取默认厨房
        const kitchens = testQuery(
          'SELECT id FROM wte_kitchens WHERE user_id = ? AND is_default = 1 AND status = 1',
          [userId]
        );
        
        if (kitchens.length === 0) {
          return error('未找到默认厨房');
        }
        
        const kitchenId = kitchens[0].id;
        
        let sql = 'SELECT id, name, description, created_at FROM wte_dishes WHERE user_id = ? AND kitchen_id = ? AND status = 1';
        const params = [userId, kitchenId];
        
        if (keyword && keyword.trim() !== '') {
          sql += ' AND name LIKE ?';
          params.push(`%${keyword.trim()}%`);
        }
        
        sql += ' ORDER BY created_at DESC';
        
        // 分页
        const offset = (page - 1) * pageSize;
        sql += ' LIMIT ? OFFSET ?';
        params.push(parseInt(pageSize), offset);
        
        const dishes = testQuery(sql, params);
        
        // 获取总数
        let countSql = 'SELECT COUNT(*) as total FROM wte_dishes WHERE user_id = ? AND kitchen_id = ? AND status = 1';
        const countParams = [userId, kitchenId];
        
        if (keyword && keyword.trim() !== '') {
          countSql += ' AND name LIKE ?';
          countParams.push(`%${keyword.trim()}%`);
        }
        
        const countResult = testQuery(countSql, countParams);
        
        return success({
          list: dishes,
          total: countResult[0].total,
          page: parseInt(page),
          pageSize: parseInt(pageSize)
        });
      }
      
      case 'get': {
        const { id } = data || {};
        
        if (!id) {
          return paramError('菜品ID不能为空');
        }
        
        const dish = testQuery(
          'SELECT id, name, description, created_at, updated_at FROM wte_dishes WHERE id = ? AND user_id = ? AND status = 1',
          [id, userId]
        );
        
        if (dish.length === 0) {
          return notFound('菜品不存在');
        }
        
        return success(dish[0]);
      }
      
      case 'update': {
        const { id, name, description } = data || {};
        
        if (!id) {
          return paramError('菜品ID不能为空');
        }
        
        if (!name || name.trim() === '') {
          return paramError('菜品名称不能为空');
        }
        
        const trimmedName = name.trim();
        const trimmedDesc = description ? description.trim() : null;
        
        // 检查菜品是否存在
        const existingDish = testQuery(
          'SELECT id, kitchen_id FROM wte_dishes WHERE id = ? AND user_id = ? AND status = 1',
          [id, userId]
        );
        
        if (existingDish.length === 0) {
          return notFound('菜品不存在');
        }
        
        // 检查新名称是否与其他菜品重复
        const duplicateCheck = testQuery(
          'SELECT id FROM wte_dishes WHERE user_id = ? AND kitchen_id = ? AND name = ? AND status = 1 AND id != ?',
          [userId, existingDish[0].kitchenId, trimmedName, id]
        );
        
        if (duplicateCheck.length > 0) {
          return error('该菜品名称已存在');
        }
        
        // 更新菜品
        testQuery(
          'UPDATE wte_dishes SET name = ?, description = ? WHERE id = ?',
          [trimmedName, trimmedDesc, id]
        );
        
        const updatedDish = testQuery(
          'SELECT id, name, description, created_at, updated_at FROM wte_dishes WHERE id = ?',
          [id]
        );
        
        return success(updatedDish[0], '菜品更新成功');
      }
      
      case 'delete': {
        const { id } = data || {};
        
        if (!id) {
          return paramError('菜品ID不能为空');
        }
        
        // 检查菜品是否存在
        const existingDish = testQuery(
          'SELECT id FROM wte_dishes WHERE id = ? AND user_id = ? AND status = 1',
          [id, userId]
        );
        
        if (existingDish.length === 0) {
          return notFound('菜品不存在');
        }
        
        // 软删除
        testQuery(
          'UPDATE wte_dishes SET status = 0 WHERE id = ?',
          [id]
        );
        
        return success(null, '菜品删除成功');
      }
      
      default:
        return paramError('未知的操作类型');
    }
  } catch (err) {
    console.error('Dish function error:', err);
    return error(err.message || '操作失败');
  }
}

describe('菜品管理云函数测试 (SQLite)', () => {
  let testUserId;
  let testKitchenId;

  beforeEach(() => {
    cleanupTestData();
    testUserId = createTestUser();
    // 获取默认厨房ID
    const kitchens = testQuery(
      'SELECT id FROM wte_kitchens WHERE user_id = ? AND is_default = 1',
      [testUserId]
    );
    testKitchenId = kitchens[0]?.id;
  });

  afterAll(() => {
    cleanupTestData();
    closeTestDB();
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

      const result = await dishMain(event, context);

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

      const result = await dishMain(event, context);

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

      const result = await dishMain(event, context);

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
      await dishMain(event1, context);

      // 再创建同名菜品
      const event2 = {
        action: 'create',
        data: {
          name: '宫保鸡丁',
          description: '描述2'
        }
      };

      const result = await dishMain(event2, context);

      expect(result.success).toBe(false);
      expect(result.code).toBe(-1);
    });
  });

  describe('获取菜品列表', () => {
    test('成功获取菜品列表', async () => {
      // 先创建几个菜品
      const context = mockContext(testUserId);
      await dishMain({
        action: 'create',
        data: { name: '菜品A', description: '描述A' }
      }, context);
      await dishMain({
        action: 'create',
        data: { name: '菜品B', description: '描述B' }
      }, context);

      const event = {
        action: 'list',
        data: { page: 1, pageSize: 10 }
      };

      const result = await dishMain(event, context);

      expect(result.success).toBe(true);
      expect(result.data.list.length).toBe(2);
      expect(result.data.total).toBe(2);
    });

    test('根据关键词搜索菜品', async () => {
      const context = mockContext(testUserId);
      await dishMain({
        action: 'create',
        data: { name: '宫保鸡丁', description: '川菜' }
      }, context);
      await dishMain({
        action: 'create',
        data: { name: '糖醋排骨', description: '江浙菜' }
      }, context);

      const event = {
        action: 'list',
        data: { keyword: '宫保', page: 1, pageSize: 10 }
      };

      const result = await dishMain(event, context);

      expect(result.success).toBe(true);
      expect(result.data.list.length).toBe(1);
      expect(result.data.list[0].name).toBe('宫保鸡丁');
    });
  });

  describe('获取单个菜品', () => {
    test('成功获取菜品详情', async () => {
      const context = mockContext(testUserId);
      const createResult = await dishMain({
        action: 'create',
        data: { name: '测试菜品', description: '测试描述' }
      }, context);

      const event = {
        action: 'get',
        data: { id: createResult.data.id }
      };

      const result = await dishMain(event, context);

      expect(result.success).toBe(true);
      expect(result.data.name).toBe('测试菜品');
    });

    test('获取菜品失败-菜品不存在', async () => {
      const event = {
        action: 'get',
        data: { id: 99999 }
      };
      const context = mockContext(testUserId);

      const result = await dishMain(event, context);

      expect(result.success).toBe(false);
      expect(result.code).toBe(404);
    });
  });

  describe('更新菜品', () => {
    test('成功更新菜品', async () => {
      const context = mockContext(testUserId);
      const createResult = await dishMain({
        action: 'create',
        data: { name: '原名称', description: '原描述' }
      }, context);

      const event = {
        action: 'update',
        data: {
          id: createResult.data.id,
          name: '新名称',
          description: '新描述'
        }
      };

      const result = await dishMain(event, context);

      expect(result.success).toBe(true);
      expect(result.data.name).toBe('新名称');
      expect(result.data.description).toBe('新描述');
    });

    test('更新菜品失败-菜品不存在', async () => {
      const event = {
        action: 'update',
        data: {
          id: 99999,
          name: '新名称'
        }
      };
      const context = mockContext(testUserId);

      const result = await dishMain(event, context);

      expect(result.success).toBe(false);
      expect(result.code).toBe(404);
    });
  });

  describe('删除菜品', () => {
    test('成功删除菜品', async () => {
      const context = mockContext(testUserId);
      const createResult = await dishMain({
        action: 'create',
        data: { name: '要删除的菜品', description: '描述' }
      }, context);

      const event = {
        action: 'delete',
        data: { id: createResult.data.id }
      };

      const result = await dishMain(event, context);

      expect(result.success).toBe(true);
      expect(result.message).toBe('菜品删除成功');

      // 验证已删除
      const getResult = await dishMain({
        action: 'get',
        data: { id: createResult.data.id }
      }, context);
      expect(getResult.success).toBe(false);
    });

    test('删除菜品失败-菜品不存在', async () => {
      const event = {
        action: 'delete',
        data: { id: 99999 }
      };
      const context = mockContext(testUserId);

      const result = await dishMain(event, context);

      expect(result.success).toBe(false);
      expect(result.code).toBe(404);
    });
  });
});
