/**
 * 厨房管理云函数
 * 提供厨房的增删改查功能，以及成员管理和邀请功能
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

const success = (data, message) => response?.success(data, message) || { code: 0, message, data, success: true };
const error = (message, code) => response?.error(message, code) || { code: code || -1, message, data: null, success: false };
const paramError = (message) => response?.paramError(message) || { code: 400, message, data: null, success: false };
const notFound = (message) => response?.notFound(message) || { code: 404, message, data: null, success: false };

exports.main = async (event, context) => {
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
      case 'getOrCreateDefault':
        return await getOrCreateDefaultKitchen(data, context);
      case 'listAccessible':
        return await listAccessibleKitchens(data, context);
      case 'listMembers':
        return await listMembers(data, context);
      case 'removeMember':
        return await removeMember(data, context);
      case 'leaveKitchen':
        return await leaveKitchen(data, context);
      case 'generateInvite':
        return await generateInvite(data, context);
      case 'getInviteInfo':
        return await getInviteInfo(data, context);
      case 'acceptInvite':
        return await acceptInvite(data, context);
      default:
        return paramError('未知的操作类型');
    }
  } catch (err) {
    console.error('Kitchen function error:', err);
    return error(err.message || '操作失败');
  }
};

/**
 * 确保厨房主人在 wte_kitchen_members 中有记录
 */
async function ensureOwnerMember(kitchenId, userId) {
  const existing = await query(
    'SELECT id FROM wte_kitchen_members WHERE kitchen_id = ? AND user_id = ? AND status = 1',
    [kitchenId, userId]
  );
  if (existing.length === 0) {
    await query(
      `INSERT INTO wte_kitchen_members (kitchen_id, user_id, role, status) VALUES (?, ?, 'owner', 1)
       ON DUPLICATE KEY UPDATE role = 'owner', status = 1`,
      [kitchenId, userId]
    );
  }
}

/**
 * 创建厨房
 */
async function createKitchen(data, context) {
  const { name } = data || {};

  if (!name || name.trim() === '') {
    return paramError('厨房名称不能为空');
  }

  const userId = await getUserId(data, context);
  const trimmedName = name.trim();

  const existingKitchens = await query(
    'SELECT id FROM wte_kitchens WHERE user_id = ? AND name = ? AND status = 1',
    [userId, trimmedName]
  );

  if (existingKitchens.length > 0) {
    return error('该厨房名称已存在');
  }

  const userKitchens = await query(
    'SELECT COUNT(*) as count FROM wte_kitchens WHERE user_id = ? AND status = 1',
    [userId]
  );
  const isDefault = userKitchens[0].count === 0 ? 1 : 0;

  const result = await query(
    'INSERT INTO wte_kitchens (user_id, name, is_default, status) VALUES (?, ?, ?, 1)',
    [userId, trimmedName, isDefault]
  );

  const kitchenId = result.insertId;

  // Auto-insert owner into kitchen_members
  await query(
    `INSERT INTO wte_kitchen_members (kitchen_id, user_id, role, status) VALUES (?, ?, 'owner', 1)
     ON DUPLICATE KEY UPDATE role = 'owner', status = 1`,
    [kitchenId, userId]
  );

  const newKitchen = await query(
    'SELECT id, name, is_default, created_at FROM wte_kitchens WHERE id = ?',
    [kitchenId]
  );

  return success(newKitchen[0], '厨房创建成功');
}

/**
 * 更新厨房
 */
async function updateKitchen(data, context) {
  const { id, name } = data || {};

  if (!id) return paramError('厨房ID不能为空');
  if (!name || name.trim() === '') return paramError('厨房名称不能为空');

  const userId = await getUserId(data, context);
  const trimmedName = name.trim();

  const existingKitchen = await query(
    'SELECT id FROM wte_kitchens WHERE id = ? AND user_id = ? AND status = 1',
    [id, userId]
  );

  if (existingKitchen.length === 0) {
    return notFound('厨房不存在');
  }

  const duplicateCheck = await query(
    'SELECT id FROM wte_kitchens WHERE user_id = ? AND name = ? AND status = 1 AND id != ?',
    [userId, trimmedName, id]
  );

  if (duplicateCheck.length > 0) {
    return error('该厨房名称已存在');
  }

  await query('UPDATE wte_kitchens SET name = ? WHERE id = ?', [trimmedName, id]);

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
  if (!id) return paramError('厨房ID不能为空');

  const userId = await getUserId(data, context);

  const existingKitchen = await query(
    'SELECT id, is_default FROM wte_kitchens WHERE id = ? AND user_id = ? AND status = 1',
    [id, userId]
  );

  if (existingKitchen.length === 0) return notFound('厨房不存在');
  if (existingKitchen[0].is_default === 1) return error('不能删除默认厨房，请先设置其他厨房为默认');

  await query('UPDATE wte_kitchens SET status = 0 WHERE id = ?', [id]);

  return success(null, '厨房删除成功');
}

/**
 * 获取用户自己创建的厨房列表
 */
async function listKitchens(data, context) {
  const userId = await getUserId(data, context);

  const kitchens = await query(
    'SELECT id, name, is_default, created_at FROM wte_kitchens WHERE user_id = ? AND status = 1 ORDER BY is_default DESC, created_at DESC',
    [userId]
  );

  return success({ list: kitchens });
}

/**
 * 获取单个厨房详情
 */
async function getKitchen(data, context) {
  const { id } = data || {};
  if (!id) return paramError('厨房ID不能为空');

  const userId = await getUserId(data, context);

  // 主人：直接拥有厨房
  let kitchen = await query(
    'SELECT id, name, is_default, created_at FROM wte_kitchens WHERE id = ? AND user_id = ? AND status = 1',
    [id, userId]
  );

  // 管理员等成员：通过成员表访问（与 listAccessible 一致）
  if (kitchen.length === 0) {
    kitchen = await query(
      `SELECT k.id, k.name, k.is_default, k.created_at
       FROM wte_kitchens k
       INNER JOIN wte_kitchen_members km ON km.kitchen_id = k.id AND km.status = 1
       WHERE k.id = ? AND k.status = 1 AND km.user_id = ?`,
      [id, userId]
    );
  }

  if (kitchen.length === 0) return notFound('厨房不存在');

  return success(kitchen[0]);
}

/**
 * 设置默认厨房
 */
async function setDefaultKitchen(data, context) {
  const { id } = data || {};
  if (!id) return paramError('厨房ID不能为空');

  const userId = await getUserId(data, context);

  const existingKitchen = await query(
    'SELECT id FROM wte_kitchens WHERE id = ? AND user_id = ? AND status = 1',
    [id, userId]
  );

  if (existingKitchen.length === 0) return notFound('厨房不存在');

  await query('UPDATE wte_kitchens SET is_default = 0 WHERE user_id = ?', [userId]);
  await query('UPDATE wte_kitchens SET is_default = 1 WHERE id = ?', [id]);

  const updatedKitchen = await query(
    'SELECT id, name, is_default, created_at, updated_at FROM wte_kitchens WHERE id = ?',
    [id]
  );

  return success(updatedKitchen[0], '默认厨房设置成功');
}

/**
 * 获取或创建默认厨房
 */
async function getOrCreateDefaultKitchen(data, context) {
  const userId = await getUserId(data, context);

  const defaultKitchen = await query(
    'SELECT id, name, is_default, created_at FROM wte_kitchens WHERE user_id = ? AND is_default = 1 AND status = 1',
    [userId]
  );

  if (defaultKitchen.length > 0) {
    await ensureOwnerMember(defaultKitchen[0].id, userId);
    return success(defaultKitchen[0], '获取默认厨房成功');
  }

  const anyKitchen = await query(
    'SELECT id, name, is_default, created_at FROM wte_kitchens WHERE user_id = ? AND status = 1 ORDER BY created_at DESC LIMIT 1',
    [userId]
  );

  if (anyKitchen.length > 0) {
    await query('UPDATE wte_kitchens SET is_default = 1 WHERE id = ?', [anyKitchen[0].id]);
    await ensureOwnerMember(anyKitchen[0].id, userId);
    return success({ ...anyKitchen[0], is_default: 1 }, '获取默认厨房成功');
  }

  const result = await query(
    'INSERT INTO wte_kitchens (user_id, name, is_default, status) VALUES (?, ?, 1, 1)',
    [userId, '我的厨房']
  );

  const kitchenId = result.insertId;
  await query(
    `INSERT INTO wte_kitchen_members (kitchen_id, user_id, role, status) VALUES (?, ?, 'owner', 1)
     ON DUPLICATE KEY UPDATE role = 'owner', status = 1`,
    [kitchenId, userId]
  );

  const newKitchen = await query(
    'SELECT id, name, is_default, created_at FROM wte_kitchens WHERE id = ?',
    [kitchenId]
  );

  return success(newKitchen[0], '创建默认厨房成功');
}

// ============================================================
// 多厨房管理 - 成员与邀请
// ============================================================

/**
 * 获取用户可访问的所有厨房（作为 owner 或 admin）
 */
async function listAccessibleKitchens(data, context) {
  const userId = await getUserId(data, context);

  const kitchens = await query(
    `SELECT k.id, k.name, k.is_default, k.user_id as owner_id, k.created_at,
            km.role,
            u.nickname as owner_name
     FROM wte_kitchen_members km
     JOIN wte_kitchens k ON km.kitchen_id = k.id AND k.status = 1
     JOIN wte_users u ON k.user_id = u.id
     WHERE km.user_id = ? AND km.status = 1
     ORDER BY km.role = 'owner' DESC, k.is_default DESC, k.created_at DESC`,
    [userId]
  );

  // Fallback: also include owned kitchens without member records (pre-migration)
  const ownedIds = new Set(kitchens.filter(k => k.role === 'owner').map(k => k.id));
  const missingOwned = await query(
    `SELECT k.id, k.name, k.is_default, k.user_id as owner_id, k.created_at,
            u.nickname as owner_name
     FROM wte_kitchens k
     JOIN wte_users u ON k.user_id = u.id
     WHERE k.user_id = ? AND k.status = 1`,
    [userId]
  );

  for (const k of missingOwned) {
    if (!ownedIds.has(k.id)) {
      kitchens.push({ ...k, role: 'owner' });
      // Auto-fix: insert the missing member record
      await ensureOwnerMember(k.id, userId);
    }
  }

  // Sort: owner first, then by is_default, then by created_at
  kitchens.sort((a, b) => {
    if (a.role === 'owner' && b.role !== 'owner') return -1;
    if (a.role !== 'owner' && b.role === 'owner') return 1;
    if (a.is_default && !b.is_default) return -1;
    if (!a.is_default && b.is_default) return 1;
    return new Date(b.created_at) - new Date(a.created_at);
  });

  return success({
    list: kitchens.map(k => ({
      id: k.id,
      name: k.name,
      isDefault: k.is_default,
      role: k.role,
      ownerId: k.owner_id,
      ownerName: k.owner_name,
      createdAt: k.created_at
    }))
  });
}

/**
 * 获取厨房成员列表（主人与管理员均可查看；邀请/移除仍仅主人可操作）
 */
async function listMembers(data, context) {
  const { kitchenId } = data || {};
  if (!kitchenId) return paramError('厨房ID不能为空');

  const userId = await getUserId(data, context);

  const ownership = await query(
    'SELECT id FROM wte_kitchens WHERE id = ? AND user_id = ? AND status = 1',
    [kitchenId, userId]
  );
  const membership = await query(
    'SELECT id FROM wte_kitchen_members WHERE kitchen_id = ? AND user_id = ? AND status = 1',
    [kitchenId, userId]
  );
  if (ownership.length === 0 && membership.length === 0) {
    return error('无权查看该厨房成员列表');
  }

  const members = await query(
    `SELECT km.id, km.user_id, km.role, km.created_at,
            u.nickname, u.avatar_url
     FROM wte_kitchen_members km
     JOIN wte_users u ON km.user_id = u.id
     WHERE km.kitchen_id = ? AND km.status = 1 AND km.role = 'admin'
     ORDER BY km.created_at DESC`,
    [kitchenId]
  );

  return success({
    list: members.map(m => ({
      id: m.id,
      userId: m.user_id,
      role: m.role,
      nickname: m.nickname,
      avatarUrl: m.avatar_url,
      joinedAt: m.created_at
    }))
  });
}

/**
 * 移除管理员（仅 owner 可调用）
 */
async function removeMember(data, context) {
  const { kitchenId, memberId } = data || {};
  if (!kitchenId || !memberId) return paramError('厨房ID和成员ID不能为空');

  const userId = await getUserId(data, context);

  const ownership = await query(
    'SELECT id FROM wte_kitchens WHERE id = ? AND user_id = ? AND status = 1',
    [kitchenId, userId]
  );
  if (ownership.length === 0) return error('只有厨房主人可以移除成员');

  // Cannot remove yourself (owner)
  const member = await query(
    'SELECT id, user_id, role FROM wte_kitchen_members WHERE id = ? AND kitchen_id = ? AND status = 1',
    [memberId, kitchenId]
  );
  if (member.length === 0) return notFound('成员不存在');
  if (member[0].role === 'owner') return error('不能移除厨房主人');

  await query('UPDATE wte_kitchen_members SET status = 0 WHERE id = ?', [memberId]);

  return success(null, '移除成功');
}

/**
 * 管理员主动退出厨房
 */
async function leaveKitchen(data, context) {
  const { kitchenId } = data || {};
  if (!kitchenId) return paramError('厨房ID不能为空');

  const userId = await getUserId(data, context);

  const membership = await query(
    'SELECT id, role FROM wte_kitchen_members WHERE kitchen_id = ? AND user_id = ? AND status = 1',
    [kitchenId, userId]
  );
  if (membership.length === 0) return notFound('你不是该厨房的成员');
  if (membership[0].role === 'owner') return error('厨房主人不能退出自己的厨房');

  await query('UPDATE wte_kitchen_members SET status = 0 WHERE id = ?', [membership[0].id]);

  return success(null, '已退出厨房');
}

/**
 * 生成厨房邀请令牌（仅 owner 可调用）
 */
async function generateInvite(data, context) {
  const { kitchenId } = data || {};
  if (!kitchenId) return paramError('厨房ID不能为空');

  const userId = await getUserId(data, context);

  const ownership = await query(
    'SELECT id, name FROM wte_kitchens WHERE id = ? AND user_id = ? AND status = 1',
    [kitchenId, userId]
  );
  if (ownership.length === 0) return error('只有厨房主人可以邀请管理员');

  // Reuse existing valid token if available
  const existing = await query(
    'SELECT token FROM wte_kitchen_invites WHERE kitchen_id = ? AND user_id = ? AND status = 1 AND expires_at > NOW()',
    [kitchenId, userId]
  );

  if (existing.length > 0) {
    return success({
      token: existing[0].token,
      kitchenId,
      kitchenName: ownership[0].name
    }, '获取邀请令牌成功');
  }

  // Revoke old tokens for this kitchen
  await query(
    'UPDATE wte_kitchen_invites SET status = 0 WHERE kitchen_id = ? AND user_id = ?',
    [kitchenId, userId]
  );

  const token = `kinvite_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  // 7 days expiry
  await query(
    `INSERT INTO wte_kitchen_invites (kitchen_id, user_id, token, expires_at)
     VALUES (?, ?, ?, DATE_ADD(NOW(), INTERVAL 7 DAY))`,
    [kitchenId, userId, token]
  );

  return success({
    token,
    kitchenId,
    kitchenName: ownership[0].name
  }, '邀请令牌生成成功');
}

/**
 * 通过邀请令牌获取厨房信息（任何人可调用）
 */
async function getInviteInfo(data, context) {
  const { token } = data || {};
  if (!token) return paramError('邀请令牌不能为空');

  const userId = await getUserId(data, context);

  const invite = await query(
    `SELECT ki.kitchen_id, ki.user_id as inviter_id, ki.expires_at,
            k.name as kitchen_name,
            u.nickname as owner_name
     FROM wte_kitchen_invites ki
     JOIN wte_kitchens k ON ki.kitchen_id = k.id AND k.status = 1
     JOIN wte_users u ON k.user_id = u.id
     WHERE ki.token = ? AND ki.status = 1`,
    [token]
  );

  if (invite.length === 0) return notFound('邀请链接已失效或不存在');

  // Check expiry
  if (new Date(invite[0].expires_at) < new Date()) {
    return error('邀请链接已过期');
  }

  // Check if user is already a member
  const membership = await query(
    'SELECT role FROM wte_kitchen_members WHERE kitchen_id = ? AND user_id = ? AND status = 1',
    [invite[0].kitchen_id, userId]
  );

  const adminCount = await query(
    'SELECT COUNT(*) as count FROM wte_kitchen_members WHERE kitchen_id = ? AND role = ? AND status = 1',
    [invite[0].kitchen_id, 'admin']
  );

  return success({
    kitchenId: invite[0].kitchen_id,
    kitchenName: invite[0].kitchen_name,
    ownerName: invite[0].owner_name,
    adminCount: adminCount[0].count,
    isAlreadyMember: membership.length > 0,
    memberRole: membership.length > 0 ? membership[0].role : null
  });
}

/**
 * 接受邀请，加入厨房成为管理员
 */
async function acceptInvite(data, context) {
  const { token } = data || {};
  if (!token) return paramError('邀请令牌不能为空');

  const userId = await getUserId(data, context);

  const invite = await query(
    `SELECT ki.kitchen_id, ki.user_id as inviter_id, ki.expires_at,
            k.name as kitchen_name
     FROM wte_kitchen_invites ki
     JOIN wte_kitchens k ON ki.kitchen_id = k.id AND k.status = 1
     WHERE ki.token = ? AND ki.status = 1`,
    [token]
  );

  if (invite.length === 0) return notFound('邀请链接已失效或不存在');
  if (new Date(invite[0].expires_at) < new Date()) return error('邀请链接已过期');

  const kitchenId = invite[0].kitchen_id;

  // Check if already a member
  const existing = await query(
    'SELECT id, role, status FROM wte_kitchen_members WHERE kitchen_id = ? AND user_id = ?',
    [kitchenId, userId]
  );

  if (existing.length > 0) {
    if (existing[0].status === 1) {
      return success({ kitchenId, kitchenName: invite[0].kitchen_name }, '你已经是该厨房的成员');
    }
    // Re-activate previously removed member
    await query(
      "UPDATE wte_kitchen_members SET status = 1, role = 'admin', invited_by = ? WHERE id = ?",
      [invite[0].inviter_id, existing[0].id]
    );
  } else {
    await query(
      `INSERT INTO wte_kitchen_members (kitchen_id, user_id, role, invited_by, status)
       VALUES (?, ?, 'admin', ?, 1)`,
      [kitchenId, userId, invite[0].inviter_id]
    );
  }

  return success({
    kitchenId,
    kitchenName: invite[0].kitchen_name
  }, '加入厨房成功');
}
