/**
 * 点餐参与人数上限（不含厨房主人与管理员）
 * 参与者记录在 wte_meals.participant_user_ids（JSON 用户ID数组，去重计数）。
 * 与 order/utils/meal-participants.js 保持同步（云函数独立部署）。
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

async function isKitchenStaff(query, kitchenId, userId) {
  const m = await query(
    'SELECT role FROM wte_kitchen_members WHERE kitchen_id = ? AND user_id = ? AND status = 1',
    [kitchenId, userId]
  );
  if (m.length > 0) return true;
  const o = await query(
    'SELECT id FROM wte_kitchens WHERE id = ? AND user_id = ? AND status = 1',
    [kitchenId, userId]
  );
  return o.length > 0;
}

async function getParticipantIdSet(query, mealId) {
  const rows = await query('SELECT participant_user_ids FROM wte_meals WHERE id = ?', [mealId]);
  if (rows.length === 0) return new Set();
  return new Set(parseParticipantIds(rows[0].participant_user_ids));
}

async function getParticipantCount(query, mealId) {
  const set = await getParticipantIdSet(query, mealId);
  return set.size;
}

/**
 * @returns {Promise<{ ok: true, staff?: boolean, already?: boolean, joined?: boolean, participantCount: number } | { ok: false, limit?: boolean, error?: string }>}
 */
async function tryRecordParticipant(query, mealId, userId) {
  const meal = await query(
    'SELECT id, kitchen_id, status, participant_user_ids FROM wte_meals WHERE id = ?',
    [mealId]
  );
  if (meal.length === 0) return { ok: false, error: 'not_found' };
  if (meal[0].status === 2) return { ok: false, error: 'closed' };
  const kitchenId = meal[0].kitchen_id;

  const merged = new Set(parseParticipantIds(meal[0].participant_user_ids));
  const cntBase = merged.size;

  if (await isKitchenStaff(query, kitchenId, userId)) {
    return { ok: true, staff: true, participantCount: cntBase };
  }

  const uid = Number(userId);
  if (merged.has(uid)) {
    return { ok: true, already: true, participantCount: cntBase };
  }
  if (cntBase >= MAX_MEAL_PARTICIPANTS) {
    return { ok: false, limit: true, participantCount: cntBase };
  }

  merged.add(uid);
  const newArr = Array.from(merged);
  await query('UPDATE wte_meals SET participant_user_ids = ? WHERE id = ?', [
    JSON.stringify(newArr),
    mealId
  ]);
  return { ok: true, joined: true, participantCount: newArr.length };
}

module.exports = {
  MAX_MEAL_PARTICIPANTS,
  isKitchenStaff,
  getParticipantCount,
  tryRecordParticipant,
  getParticipantIdSet,
  parseParticipantIds
};
