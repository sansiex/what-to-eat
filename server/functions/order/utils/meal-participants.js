/**
 * 点餐参与人数校验（与 meal/utils/meal-participants.js 同步）
 * 参与者见 wte_meals.participant_user_ids
 */

const MAX_MEAL_PARTICIPANTS = 15;

function parseParticipantIds(val) {
  if (val == null || val === '') return [];
  if (typeof val === 'string') {
    try {
      const p = JSON.parse(val);
      return Array.isArray(p) ? p.map((x) => Number(x)) : [];
    } catch {
      return [];
    }
  }
  if (Array.isArray(val)) return val.map((x) => Number(x));
  return [];
}

async function isKitchenStaffConn(connection, kitchenId, userId) {
  const [m] = await connection.query(
    'SELECT role FROM wte_kitchen_members WHERE kitchen_id = ? AND user_id = ? AND status = 1',
    [kitchenId, userId]
  );
  if (m.length > 0) return true;
  const [o] = await connection.query(
    'SELECT id FROM wte_kitchens WHERE id = ? AND user_id = ? AND status = 1',
    [kitchenId, userId]
  );
  return o.length > 0;
}

/**
 * 非厨房人员：若未计入且已满员则抛错（下单前）
 */
async function assertParticipantSlotForOrder(connection, mealId, userId) {
  const [meal] = await connection.query(
    'SELECT kitchen_id, status, participant_user_ids FROM wte_meals WHERE id = ?',
    [mealId]
  );
  if (meal.length === 0) throw new Error('点餐活动不存在');
  if (meal[0].status === 2) throw new Error('该点餐活动已收单，无法下单');
  const kitchenId = meal[0].kitchen_id;
  if (await isKitchenStaffConn(connection, kitchenId, userId)) return;

  const merged = new Set(parseParticipantIds(meal[0].participant_user_ids));
  const uid = Number(userId);
  if (merged.has(uid)) return;
  if (merged.size >= MAX_MEAL_PARTICIPANTS) {
    throw new Error('参与点餐人数已达上限，无法加入更多人点餐。');
  }
}

/** 下单成功后写入 participant_user_ids（非厨房人员） */
async function insertParticipantIfNeeded(connection, mealId, userId) {
  const [meal] = await connection.query(
    'SELECT kitchen_id, participant_user_ids FROM wte_meals WHERE id = ?',
    [mealId]
  );
  if (meal.length === 0) return;
  const kitchenId = meal[0].kitchen_id;
  if (await isKitchenStaffConn(connection, kitchenId, userId)) return;

  const uid = Number(userId);
  const merged = new Set(parseParticipantIds(meal[0].participant_user_ids));
  if (merged.has(uid)) return;
  merged.add(uid);
  await connection.query('UPDATE wte_meals SET participant_user_ids = ? WHERE id = ?', [
    JSON.stringify(Array.from(merged)),
    mealId
  ]);
}

module.exports = {
  MAX_MEAL_PARTICIPANTS,
  assertParticipantSlotForOrder,
  insertParticipantIfNeeded
};
