/**
 * 调试云函数：承接原 scripts 中直连 MySQL 的只读/运维逻辑。
 * 必须配置环境变量 WTE_DEBUG_SECRET；请求需在 data 或根级携带相同 secret。
 * 勿在小程序中调用；部署后可在云开发控制台限制触发来源或不上线 HTTP。
 */

const { success, error, paramError, unauthorized, serverError } = require('./utils/response');

function jsonSafe(obj) {
  try {
    return JSON.parse(JSON.stringify(obj, (_, v) => (typeof v === 'bigint' ? String(v) : v)));
  } catch (e) {
    return obj;
  }
}

/**
 * 兼容：wx.cloud data 扁平；HTTP 网关 { action, data: { secret, ... } }
 */
function parseDebugEvent(raw) {
  const event = raw && typeof raw === 'object' ? raw : {};
  const nested = event.data && typeof event.data === 'object' ? event.data : {};
  const secret = nested.secret != null ? nested.secret : event.secret;
  let action = event.action != null ? event.action : nested.action;
  const payload = { ...nested };
  delete payload.secret;
  delete payload.action;
  for (const k of Object.keys(event)) {
    if (k === 'action' || k === 'secret' || k === 'data') continue;
    payload[k] = event[k];
  }
  return { secret, action, payload };
}

function assertSecret(incoming) {
  const expected = process.env.WTE_DEBUG_SECRET;
  if (expected == null || String(expected).trim() === '') {
    return error('debug 云函数未配置 WTE_DEBUG_SECRET', 503);
  }
  if (incoming !== expected) {
    return unauthorized('无效调试密钥');
  }
  return null;
}

async function runAction(action, payload, query, transaction) {
  switch (action) {
    case 'ping':
      return success({ ok: true });

    case 'listActions':
      return success({
        actions: [
          'ping',
          'listActions',
          'checkDb',
          'checkOrders',
          'checkOrdersDetail',
          'checkUsers',
          'debugDishes',
          'checkMenuTables',
          'checkOpenid',
          'checkUserById',
          'checkKitchens',
          'checkDataIsolation',
          'checkMyOrder',
          'mergeDuplicateUsers',
          'fixUserOpenid',
          'fixUserStatus',
          'migrateUserData'
        ]
      });

    case 'checkDb': {
      const tables = await query('SHOW TABLES');
      const dishes = await query('SELECT * FROM wte_dishes WHERE status = 1');
      const kitchens = await query('SELECT * FROM wte_kitchens');
      const meals = await query('SELECT * FROM wte_meals WHERE status = 1');
      const orders = await query('SELECT * FROM wte_orders');
      let orderDishes = null;
      try {
        orderDishes = await query('SELECT * FROM wte_order_dishes LIMIT 500');
      } catch (e) {
        orderDishes = { _note: '表可能不存在（当前 DDL 以 wte_orders 行为准）', error: e.message };
      }
      const users = await query('SELECT * FROM wte_users');
      const orderDishesCount = Array.isArray(orderDishes) ? orderDishes.length : 0;
      return success(
        jsonSafe({
          tables,
          dishes,
          kitchens,
          meals,
          orders,
          orderDishes,
          users,
          counts: {
            dishes: dishes.length,
            kitchens: kitchens.length,
            meals: meals.length,
            orders: orders.length,
            orderDishes: orderDishesCount,
            users: users.length
          }
        }),
        'checkDb'
      );
    }

    case 'checkOrders': {
      const mealId = payload.mealId != null ? Number(payload.mealId) : 1;
      const kitchenId = payload.kitchenId != null ? Number(payload.kitchenId) : 1;
      const orderColumns = await query('DESCRIBE wte_orders');
      const orderDetails = await query(
        `SELECT o.id as order_id, o.meal_id, o.user_id, o.dish_id, d.name as dish_name, o.status, o.created_at
         FROM wte_orders o
         JOIN wte_dishes d ON o.dish_id = d.id
         WHERE o.meal_id = ? AND o.status = 1`,
        [mealId]
      );
      const stats = await query(
        `SELECT d.id as dish_id, d.name as dish_name, COUNT(o.id) as order_count
         FROM wte_dishes d
         LEFT JOIN wte_orders o ON d.id = o.dish_id AND o.meal_id = ? AND o.status = 1
         WHERE d.kitchen_id = ? AND d.status = 1
         GROUP BY d.id, d.name`,
        [mealId, kitchenId]
      );
      return success(jsonSafe({ orderColumns, orderDetails, stats }));
    }

    case 'checkOrdersDetail': {
      const mealId = payload.mealId != null ? Number(payload.mealId) : 1;
      const orders = await query(
        `SELECT o.id, o.meal_id, o.user_id, o.dish_id, d.name as dish_name, o.status, o.created_at
         FROM wte_orders o
         JOIN wte_dishes d ON o.dish_id = d.id
         ORDER BY o.created_at DESC`
      );
      const stats = await query(
        `SELECT d.id as dish_id, d.name as dish_name, COUNT(o.id) as order_count
         FROM wte_dishes d
         LEFT JOIN wte_orders o ON d.id = o.dish_id AND o.meal_id = ? AND o.status = 1
         WHERE d.kitchen_id = ? AND d.status = 1
         GROUP BY d.id, d.name`,
        [mealId, payload.kitchenId != null ? Number(payload.kitchenId) : 1]
      );
      const orderers = await query(
        `SELECT o.dish_id, d.name as dish_name, u.nickname
         FROM wte_orders o
         JOIN wte_dishes d ON o.dish_id = d.id
         JOIN wte_users u ON o.user_id = u.id
         WHERE o.meal_id = ? AND o.status = 1
         ORDER BY o.dish_id`,
        [mealId]
      );
      return success(jsonSafe({ orders, stats, orderers }));
    }

    case 'checkUsers': {
      const users = await query('SELECT id, openid, nickname, status FROM wte_users');
      const orders = await query(
        'SELECT id, meal_id, user_id, dish_id, status FROM wte_orders WHERE status = 1 LIMIT 10'
      );
      return success(jsonSafe({ users, orders }));
    }

    case 'debugDishes': {
      const dishes = await query(
        `SELECT id, name, user_id, kitchen_id, status, created_at
         FROM wte_dishes WHERE status = 1 ORDER BY id`
      );
      const users = await query(
        `SELECT id, openid, nickname, status, created_at
         FROM wte_users WHERE status = 1 ORDER BY id`
      );
      const kitchens = await query(
        `SELECT id, name, user_id, is_default, status, created_at
         FROM wte_kitchens WHERE status = 1 ORDER BY id`
      );
      const relations = await query(
        `SELECT d.id as dish_id, d.name as dish_name, d.user_id as dish_user_id,
                d.kitchen_id as dish_kitchen_id, u.nickname as user_nickname,
                k.name as kitchen_name, k.user_id as kitchen_user_id
         FROM wte_dishes d
         LEFT JOIN wte_users u ON d.user_id = u.id
         LEFT JOIN wte_kitchens k ON d.kitchen_id = k.id
         WHERE d.status = 1 ORDER BY d.id`
      );
      return success(jsonSafe({ dishes, users, kitchens, relations }));
    }

    case 'checkMenuTables': {
      const tables = await query('SHOW TABLES');
      let menus = [];
      let menuDishes = [];
      try {
        menus = await query('SELECT * FROM wte_menus LIMIT 5');
      } catch (e) {
        menus = { error: e.message };
      }
      try {
        menuDishes = await query('SELECT * FROM wte_menu_dishes LIMIT 5');
      } catch (e) {
        menuDishes = { error: e.message };
      }
      return success(jsonSafe({ tables, menus, menuDishes }));
    }

    case 'checkOpenid': {
      const openid = payload.openid != null ? String(payload.openid).trim() : '';
      if (!openid) return paramError('缺少 openid');
      const users = await query(
        'SELECT id, openid, nickname, status FROM wte_users WHERE openid = ?',
        [openid]
      );
      let kitchens = [];
      if (users.length > 0) {
        const userId = users[0].id;
        kitchens = await query(
          'SELECT id, name, user_id, is_default, status FROM wte_kitchens WHERE user_id = ? AND status = 1',
          [userId]
        );
      }
      const allUsers = await query(
        'SELECT id, openid, nickname, status FROM wte_users ORDER BY id'
      );
      return success(jsonSafe({ users, kitchens, allUsers }));
    }

    case 'checkUserById': {
      const userId = payload.userId != null ? Number(payload.userId) : 5;
      const users = await query(
        `SELECT id, openid, nickname, avatar_url, status, created_at, last_login_at
         FROM wte_users WHERE id = ?`,
        [userId]
      );
      const allUsers = await query(
        `SELECT id, openid, nickname FROM wte_users ORDER BY id`
      );
      return success(jsonSafe({ users, allUsers }));
    }

    case 'checkKitchens': {
      const kitchens = await query(
        `SELECT id, name, user_id, is_default, status, created_at
         FROM wte_kitchens ORDER BY user_id, id`
      );
      const filterUserId = payload.userId != null ? Number(payload.userId) : 5;
      const userKitchens = await query(
        `SELECT id, name, user_id, is_default, status, created_at
         FROM wte_kitchens WHERE user_id = ? AND status = 1`,
        [filterUserId]
      );
      return success(jsonSafe({ kitchens, userKitchens, filterUserId }));
    }

    case 'checkDataIsolation': {
      const users = await query(
        `SELECT id, openid, nickname, status, created_at
         FROM wte_users WHERE status = 1 ORDER BY id`
      );
      const kitchens = await query(
        `SELECT id, name, user_id, is_default, status, created_at
         FROM wte_kitchens WHERE status = 1 ORDER BY id`
      );
      const dishes = await query(
        `SELECT id, name, user_id, kitchen_id, status, created_at
         FROM wte_dishes WHERE status = 1 ORDER BY id`
      );
      const menus = await query(
        `SELECT id, name, user_id, kitchen_id, status, created_at
         FROM wte_menus WHERE status = 1 ORDER BY id`
      );
      const relations = await query(
        `SELECT u.id as user_id, u.nickname, k.id as kitchen_id, k.name as kitchen_name,
                COUNT(DISTINCT d.id) as dish_count, COUNT(DISTINCT m.id) as menu_count
         FROM wte_users u
         LEFT JOIN wte_kitchens k ON u.id = k.user_id AND k.status = 1
         LEFT JOIN wte_dishes d ON k.id = d.kitchen_id AND d.status = 1
         LEFT JOIN wte_menus m ON k.id = m.kitchen_id AND m.status = 1
         WHERE u.status = 1
         GROUP BY u.id, k.id`
      );
      return success(jsonSafe({ users, kitchens, dishes, menus, relations }));
    }

    case 'checkMyOrder': {
      const mealId = payload.mealId != null ? Number(payload.mealId) : 1;
      const userId = payload.userId != null ? Number(payload.userId) : 1;
      const orders = await query(
        `SELECT o.id, o.dish_id, d.name as dish_name, o.created_at
         FROM wte_orders o
         INNER JOIN wte_dishes d ON o.dish_id = d.id
         WHERE o.meal_id = ? AND o.user_id = ? AND o.status = 1
         ORDER BY o.created_at DESC`,
        [mealId, userId]
      );
      const frontend = orders.length
        ? {
            mealId,
            hasOrdered: true,
            orders: orders.map((o) => ({
              dishId: o.dish_id,
              dishName: o.dish_name,
              createdAt: o.created_at
            }))
          }
        : { mealId, hasOrdered: false, orders: [] };
      return success(jsonSafe({ orders, frontend }));
    }

    case 'mergeDuplicateUsers': {
      const targetUserId = payload.targetUserId != null ? Number(payload.targetUserId) : 5;
      const duplicateUserIds = Array.isArray(payload.duplicateUserIds)
        ? payload.duplicateUserIds.map((n) => Number(n))
        : [6, 7];
      const fixedOpenid =
        payload.fixedOpenid != null
          ? String(payload.fixedOpenid)
          : 'dev_local_sansi_fixed_id';
      if (!duplicateUserIds.length) return paramError('duplicateUserIds 不能为空');
      const ph = duplicateUserIds.map(() => '?').join(',');
      const spread = [targetUserId, ...duplicateUserIds];
      await transaction(async (conn) => {
        await conn.query(`UPDATE wte_kitchens SET user_id = ? WHERE user_id IN (${ph})`, spread);
        await conn.query(`UPDATE wte_dishes SET user_id = ? WHERE user_id IN (${ph})`, spread);
        await conn.query(`UPDATE wte_menus SET user_id = ? WHERE user_id IN (${ph})`, spread);
        await conn.query(`UPDATE wte_meals SET user_id = ? WHERE user_id IN (${ph})`, spread);
        await conn.query(`UPDATE wte_orders SET user_id = ? WHERE user_id IN (${ph})`, spread);
        for (const uid of duplicateUserIds) {
          await conn.query('UPDATE wte_users SET status = 0 WHERE id = ?', [uid]);
        }
        await conn.query('UPDATE wte_users SET openid = ? WHERE id = ?', [fixedOpenid, targetUserId]);
      });
      const users = await query(
        'SELECT id, openid, nickname, status FROM wte_users WHERE status = 1 ORDER BY id'
      );
      return success(jsonSafe({ targetUserId, duplicateUserIds, users }), 'mergeDuplicateUsers 完成');
    }

    case 'fixUserOpenid': {
      const userId = payload.userId != null ? Number(payload.userId) : 5;
      const newOpenid =
        payload.newOpenid != null && String(payload.newOpenid).trim()
          ? String(payload.newOpenid).trim()
          : `mock_openid_fixed_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;
      await query('UPDATE wte_users SET openid = ? WHERE id = ?', [newOpenid, userId]);
      const users = await query('SELECT id, openid, nickname FROM wte_users WHERE id = ?', [userId]);
      return success(jsonSafe({ userId, newOpenid, user: users[0] || null }));
    }

    case 'fixUserStatus': {
      const targetUserId = payload.targetUserId != null ? Number(payload.targetUserId) : 5;
      const fixedOpenid =
        payload.fixedOpenid != null
          ? String(payload.fixedOpenid)
          : 'dev_local_sansi_fixed_id';
      const allBefore = await query(
        'SELECT id, openid, nickname, status FROM wte_users ORDER BY id'
      );
      const duplicates = await query(
        'SELECT openid, COUNT(*) AS cnt FROM wte_users GROUP BY openid HAVING cnt > 1'
      );
      await query('UPDATE wte_users SET status = 1, openid = ? WHERE id = ?', [
        fixedOpenid,
        targetUserId
      ]);
      const sameOpenid = await query(
        'SELECT id, openid, nickname, status FROM wte_users WHERE openid = ?',
        [fixedOpenid]
      );
      if (sameOpenid.length > 1) {
        for (const user of sameOpenid) {
          if (user.id !== targetUserId) {
            const newOid = `fixed_openid_${user.id}_${Date.now()}`;
            await query('UPDATE wte_users SET openid = ? WHERE id = ?', [newOid, user.id]);
          }
        }
      }
      const finalUsers = await query(
        'SELECT id, openid, nickname, status FROM wte_users ORDER BY id'
      );
      return success(
        jsonSafe({ allBefore, duplicates, sameOpenidAfter: sameOpenid, finalUsers }),
        'fixUserStatus 完成'
      );
    }

    case 'migrateUserData': {
      const fromUserId = payload.fromUserId != null ? Number(payload.fromUserId) : 14;
      const toUserId = payload.toUserId != null ? Number(payload.toUserId) : 15;
      const toNickname = payload.toNickname != null ? String(payload.toNickname) : '三思';
      const softDeleteFrom = payload.softDeleteFrom !== false;
      await transaction(async (conn) => {
        await conn.query('UPDATE wte_users SET nickname = ? WHERE id = ?', [toNickname, toUserId]);
        await conn.query('UPDATE wte_kitchens SET user_id = ? WHERE user_id = ?', [
          toUserId,
          fromUserId
        ]);
        await conn.query('UPDATE wte_dishes SET user_id = ? WHERE user_id = ?', [
          toUserId,
          fromUserId
        ]);
        await conn.query('UPDATE wte_menus SET user_id = ? WHERE user_id = ?', [
          toUserId,
          fromUserId
        ]);
        await conn.query('UPDATE wte_meals SET user_id = ? WHERE user_id = ?', [
          toUserId,
          fromUserId
        ]);
        await conn.query('UPDATE wte_orders SET user_id = ? WHERE user_id = ?', [
          toUserId,
          fromUserId
        ]);
        if (softDeleteFrom) {
          await conn.query('UPDATE wte_users SET status = 0 WHERE id = ?', [fromUserId]);
        }
      });
      const users = await query(
        'SELECT id, openid, nickname, status FROM wte_users WHERE status = 1 ORDER BY id'
      );
      const kitchens = await query('SELECT id, name, user_id FROM wte_kitchens WHERE user_id = ?', [
        toUserId
      ]);
      return success(jsonSafe({ fromUserId, toUserId, users, kitchens }), 'migrateUserData 完成');
    }

    default:
      return paramError(`未知 action: ${action}`);
  }
}

exports.main = async (event) => {
  try {
    const { secret, action, payload } = parseDebugEvent(event);
    const authErr = assertSecret(secret);
    if (authErr) return authErr;

    if (!action) return paramError('缺少 action');

    if (action === 'ping' || action === 'listActions') {
      return await runAction(action, payload, null, null);
    }

    const { query, transaction } = require('./utils/db');
    return await runAction(action, payload, query, transaction);
  } catch (err) {
    console.error('debug cloud error:', err);
    return serverError(err.message || String(err));
  }
};
