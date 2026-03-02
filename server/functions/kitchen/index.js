/**
 * 厨房管理云函数
 * 提供厨房的增删改查功能
 */

let db;
let response;
let loadError = null;

try {
  db = require('./utils/db');
  response = require('./utils/response');
  console.log('Utils loaded successfully');
} catch (err) {
  console.error('Failed to load utils:', err);
  loadError = err;
}

const { query, getUserId } = db || {};

// 使用函数包装，确保在测试时能获取到 mock 的 response 函数
const success = (data, message) => response?.success(data, message) || { code: 0, message, data, success: true };
const error = (message, code) => response?.error(message, code) || { code: code || -1, message, data: null, success: false };
const paramError = (message) => response?.paramError(message) || { code: 400, message, data: null, success: false };
const notFound = (message) => response?.notFound(message) || { code: 404, message, data: null, success: false };

/**
 * 主入口函数
 */
exports.main = async (event, context) => {
  // 检查依赖加载是否失败
  if (loadError) {
    return {
      success: false,
      code: -1,
      message: 'Failed to load dependencies: ' + loadError.message,
      data: null
    };
  }

  const { action, data } = event;

  console.log('Kitchen function called:', { action, data });

  try {
    switch (action) {
      case 'create':
        return await createKitchen(data, context);
      case 'update':
        return await updateKitchen(data, context);
      case 'delete':
        return await deleteKitchen(data, context);
      case 'list':
        return await listKitchens(data, context);
      case 'get':
        return await getKitchen(data, context);
      case 'setDefault':
        return await setDefaultKitchen(data, context);
      default:
        return paramError('未知的操作类型');
    }
  } catch (err) {
    console.error('Kitchen function error:', err);
    return error(err.message || '操作失败');
  }
};

/**
 * 创建厨房
 */
async function createKitchen(data, context) {
  const { name } = data || {};

  if (!name || name.trim() === '') {
    return paramError('厨房名称不能为空');
  }

  const userId = getUserId(context);
  const trimmedName = name.trim();

  // 检查是否已存在同名厨房
  const existingKitchens = await query(
    'SELECT id FROM wte_kitchens WHERE user_id = ? AND name = ? AND status = 1',
    [userId, trimmedName]
  );

  if (existingKitchens.length > 0) {
    return error('该厨房名称已存在');
  }

  // 检查用户是否已有厨房，如果没有则设为默认
  const userKitchens = await query(
    'SELECT COUNT(*) as count FROM wte_kitchens WHERE user_id = ? AND status = 1',
    [userId]
  );
  const isDefault = userKitchens[0].count === 0 ? 1 : 0;

  // 插入新厨房
  const result = await query(
    'INSERT INTO wte_kitchens (user_id, name, is_default, status) VALUES (?, ?, ?, 1)',
    [userId, trimmedName, isDefault]
  );

  const newKitchen = await query(
    'SELECT id, name, is_default, created_at FROM wte_kitchens WHERE id = ?',
    [result.insertId]
  );

  return success(newKitchen[0], '厨房创建成功');
}

/**
 * 更新厨房
 */
async function updateKitchen(data, context) {
  const { id, name } = data || {};

  if (!id) {
    return paramError('厨房ID不能为空');
  }

  if (!name || name.trim() === '') {
    return paramError('厨房名称不能为空');
  }

  const userId = getUserId(context);
  const trimmedName = name.trim();

  // 检查厨房是否存在且属于当前用户
  const existingKitchen = await query(
    'SELECT id FROM wte_kitchens WHERE id = ? AND user_id = ? AND status = 1',
    [id, userId]
  );

  if (existingKitchen.length === 0) {
    return notFound('厨房不存在');
  }

  // 检查新名称是否与其他厨房重复
  const duplicateCheck = await query(
    'SELECT id FROM wte_kitchens WHERE user_id = ? AND name = ? AND status = 1 AND id != ?',
    [userId, trimmedName, id]
  );

  if (duplicateCheck.length > 0) {
    return error('该厨房名称已存在');
  }

  // 更新厨房
  await query(
    'UPDATE wte_kitchens SET name = ? WHERE id = ?',
    [trimmedName, id]
  );

  const updatedKitchen = await query(
    'SELECT id, name, is_default, created_at, updated_at FROM wte_kitchens WHERE id = ?',
    [id]
  );

  return success(updatedKitchen[0], '厨房更新成功');
}

/**
 * 删除厨房（软删除）
 */
async function deleteKitchen(data, context) {
  const { id } = data || {};

  if (!id) {
    return paramError('厨房ID不能为空');
  }

  const userId = getUserId(context);

  // 检查厨房是否存在且属于当前用户
  const existingKitchen = await query(
    'SELECT id, is_default FROM wte_kitchens WHERE id = ? AND user_id = ? AND status = 1',
    [id, userId]
  );

  if (existingKitchen.length === 0) {
    return notFound('厨房不存在');
  }

  // 不能删除默认厨房
  if (existingKitchen[0].is_default === 1) {
    return error('不能删除默认厨房，请先设置其他厨房为默认');
  }

  // 软删除
  await query(
    'UPDATE wte_kitchens SET status = 0 WHERE id = ?',
    [id]
  );

  return success(null, '厨房删除成功');
}

/**
 * 获取厨房列表
 */
async function listKitchens(data, context) {
  const userId = getUserId(context);

  const kitchens = await query(
    'SELECT id, name, is_default, created_at FROM wte_kitchens WHERE user_id = ? AND status = 1 ORDER BY is_default DESC, created_at DESC',
    [userId]
  );

  return success({
    list: kitchens
  });
}

/**
 * 获取单个厨房详情
 */
async function getKitchen(data, context) {
  const { id } = data || {};

  if (!id) {
    return paramError('厨房ID不能为空');
  }

  const userId = getUserId(context);

  const kitchen = await query(
    'SELECT id, name, is_default, created_at FROM wte_kitchens WHERE id = ? AND user_id = ? AND status = 1',
    [id, userId]
  );

  if (kitchen.length === 0) {
    return notFound('厨房不存在');
  }

  return success(kitchen[0]);
}

/**
 * 设置默认厨房
 */
async function setDefaultKitchen(data, context) {
  const { id } = data || {};

  if (!id) {
    return paramError('厨房ID不能为空');
  }

  const userId = getUserId(context);

  // 检查厨房是否存在且属于当前用户
  const existingKitchen = await query(
    'SELECT id FROM wte_kitchens WHERE id = ? AND user_id = ? AND status = 1',
    [id, userId]
  );

  if (existingKitchen.length === 0) {
    return notFound('厨房不存在');
  }

  // 先将所有厨房设为非默认
  await query(
    'UPDATE wte_kitchens SET is_default = 0 WHERE user_id = ?',
    [userId]
  );

  // 将指定厨房设为默认
  await query(
    'UPDATE wte_kitchens SET is_default = 1 WHERE id = ?',
    [id]
  );

  const updatedKitchen = await query(
    'SELECT id, name, is_default, created_at, updated_at FROM wte_kitchens WHERE id = ?',
    [id]
  );

  return success(updatedKitchen[0], '默认厨房设置成功');
}
