/**
 * 用户管理云函数
 * 提供用户登录、注册、信息更新等功能
 */

const { query, getUserId } = require('../utils/db');
const { success, error, paramError, notFound } = require('../utils/response');

/**
 * 主入口函数
 * @param {Object} event - 请求参数
 * @param {Object} context - 云函数上下文
 * @returns {Object} 响应结果
 */
exports.main = async (event, context) => {
  const { action, data } = event;
  
  try {
    switch (action) {
      case 'login':
        return await login(data, context);
      case 'update':
        return await updateUser(data, context);
      case 'get':
        return await getUser(data, context);
      default:
        return paramError('未知的操作类型');
    }
  } catch (err) {
    console.error('User function error:', err);
    return error(err.message || '操作失败');
  }
};

/**
 * 用户登录/注册
 * @param {Object} data - 登录数据
 * @param {Object} context - 上下文
 * @returns {Object} 登录结果
 */
async function login(data, context) {
  const { code, userInfo } = data || {};
  
  if (!code) {
    return paramError('登录凭证不能为空');
  }
  
  // 实际部署时，这里需要调用微信接口获取openid
  // 目前使用模拟数据
  const mockOpenid = `mock_openid_${code}`;
  
  // 查询用户是否存在
  let user = await query(
    'SELECT id, openid, nickname, avatar_url, status FROM wte_users WHERE openid = ?',
    [mockOpenid]
  );
  
  if (user.length === 0) {
    // 新用户，创建用户记录
    const nickname = userInfo?.nickName || '微信用户';
    const avatarUrl = userInfo?.avatarUrl || null;
    
    const result = await query(
      'INSERT INTO wte_users (openid, nickname, avatar_url) VALUES (?, ?, ?)',
      [mockOpenid, nickname, avatarUrl]
    );
    
    user = await query(
      'SELECT id, openid, nickname, avatar_url, status FROM wte_users WHERE id = ?',
      [result.insertId]
    );
  } else {
    // 更新最后登录时间
    await query(
      'UPDATE wte_users SET last_login_at = NOW() WHERE id = ?',
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
        await query(
          `UPDATE wte_users SET ${updates.join(', ')} WHERE id = ?`,
          params
        );
        
        // 重新查询用户信息
        user = await query(
          'SELECT id, openid, nickname, avatar_url, status FROM wte_users WHERE id = ?',
          [user[0].id]
        );
      }
    }
  }
  
  if (user[0].status === 0) {
    return error('账号已被禁用');
  }
  
  return success({
    id: user[0].id,
    openid: user[0].openid,
    nickname: user[0].nickname,
    avatarUrl: user[0].avatar_url
  }, '登录成功');
}

/**
 * 更新用户信息
 * @param {Object} data - 更新数据
 * @param {Object} context - 上下文
 * @returns {Object} 更新结果
 */
async function updateUser(data, context) {
  const { nickname, avatarUrl } = data || {};
  const userId = getUserId(context);
  
  // 检查用户是否存在
  const user = await query(
    'SELECT id FROM wte_users WHERE id = ? AND status = 1',
    [userId]
  );
  
  if (user.length === 0) {
    return notFound('用户不存在');
  }
  
  const updates = [];
  const params = [];
  
  if (nickname !== undefined) {
    updates.push('nickname = ?');
    params.push(nickname.trim());
  }
  
  if (avatarUrl !== undefined) {
    updates.push('avatar_url = ?');
    params.push(avatarUrl);
  }
  
  if (updates.length === 0) {
    return paramError('没有要更新的字段');
  }
  
  params.push(userId);
  
  await query(
    `UPDATE wte_users SET ${updates.join(', ')} WHERE id = ?`,
    params
  );
  
  // 返回更新后的用户信息
  const updatedUser = await query(
    'SELECT id, openid, nickname, avatar_url, status FROM wte_users WHERE id = ?',
    [userId]
  );
  
  return success({
    id: updatedUser[0].id,
    openid: updatedUser[0].openid,
    nickname: updatedUser[0].nickname,
    avatarUrl: updatedUser[0].avatar_url
  }, '更新成功');
}

/**
 * 获取用户信息
 * @param {Object} data - 查询参数
 * @param {Object} context - 上下文
 * @returns {Object} 用户信息
 */
async function getUser(data, context) {
  const userId = getUserId(context);
  
  const user = await query(
    'SELECT id, openid, nickname, avatar_url, status, created_at, last_login_at FROM wte_users WHERE id = ?',
    [userId]
  );
  
  if (user.length === 0) {
    return notFound('用户不存在');
  }
  
  return success({
    id: user[0].id,
    openid: user[0].openid,
    nickname: user[0].nickname,
    avatarUrl: user[0].avatar_url,
    status: user[0].status,
    createdAt: user[0].created_at,
    lastLoginAt: user[0].last_login_at
  });
}
