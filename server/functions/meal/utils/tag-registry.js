/**
 * 菜品标签定义（服务端校验 + 返回文案）
 * 新增类型/标签时在此扩展
 *
 * 注意：与 ../order/utils/tag-registry.js 须保持完全一致（各云函数独立部署，不能 require 包外模块）
 */

const CATEGORIES = [
  {
    key: 'spiciness',
    label: '辣度',
    colorKey: 'red',
    tags: [
      { code: 'none', label: '不辣' },
      { code: 'mild', label: '微辣' },
      { code: 'medium', label: '中辣' },
      { code: 'hot', label: '重辣' }
    ]
  },
  {
    key: 'taboo',
    label: '忌口',
    colorKey: 'blue',
    tags: [
      { code: 'no_cilantro', label: '不要香菜' },
      { code: 'no_scallion', label: '不要葱' },
      { code: 'no_garlic', label: '不要蒜' },
      { code: 'no_ginger', label: '不要姜' }
    ]
  }
]

const categoryMap = new Map(CATEGORIES.map(c => [c.key, c]))
const tagLookup = new Map()
CATEGORIES.forEach(c => {
  c.tags.forEach(t => {
    tagLookup.set(`${c.key}:${t.code}`, { category: c, tag: t })
  })
})

function isValidTag(categoryKey, tagCode) {
  return tagLookup.has(`${categoryKey}:${tagCode}`)
}

function getTagLabel(categoryKey, tagCode) {
  const hit = tagLookup.get(`${categoryKey}:${tagCode}`)
  return hit ? hit.tag.label : tagCode
}

function getCategoryMeta(categoryKey) {
  return categoryMap.get(categoryKey) || null
}

/**
 * @param {Array<{dish_id:number,category:string,tag_code:string,user_id:number,nickname?:string}>} rows
 * @param {number} currentUserId
 * @returns {Map<number, { tagDisplay: { groups: any[], myTags: any[] } }>}
 */
/** 订单行 tags 列：JSON 数组 [{ categoryKey, tagCode }] */
function normalizeTagItem(t) {
  if (!t || typeof t !== 'object') return null
  const categoryKey = t.categoryKey || t.category
  const tagCode = t.tagCode || t.code
  if (!categoryKey || !tagCode) return null
  return { categoryKey, tagCode }
}

function parseTagsColumn(val) {
  if (val == null || val === '') return []
  if (typeof Buffer !== 'undefined' && Buffer.isBuffer(val)) {
    val = val.toString('utf8')
  }
  if (typeof val === 'string') {
    try {
      const j = JSON.parse(val)
      if (!Array.isArray(j)) return []
      return j.map(normalizeTagItem).filter(Boolean)
    } catch {
      return []
    }
  }
  if (Array.isArray(val)) {
    return val.map(normalizeTagItem).filter(Boolean)
  }
  return []
}

function serializeTagsForDb(list) {
  const normalized = (list || []).map(normalizeTagItem).filter(Boolean)
  return JSON.stringify(normalized)
}

/**
 * 将 wte_orders 行（含 dish_id、tags、user_id、nickname）展开为 buildDishTagDisplaysByDishId 所需行
 */
function expandOrderRowsToTagRows(orderRows) {
  const rows = []
  for (const o of orderRows || []) {
    const dishId = o.dish_id != null ? o.dish_id : o.dishId
    if (dishId == null) continue
    const uid = o.user_id != null ? o.user_id : o.userId
    const tags = parseTagsColumn(o.tags)
    const nick = o.nickname || '用户'
    for (const t of tags) {
      rows.push({
        dish_id: dishId,
        category: t.categoryKey,
        tag_code: t.tagCode,
        user_id: uid,
        nickname: nick
      })
    }
  }
  return rows
}

/**
 * 合并新标签到已有列表（辣度互斥；忌口可多条去重）
 * @param {Array<{categoryKey:string,tagCode:string}>} existing
 * @param {Array<{categoryKey?:string,category?:string,tagCode?:string,code?:string}>} toAdd validated
 */
function mergeTagsIntoList(existing, toAdd) {
  let list = (existing || []).map(normalizeTagItem).filter(Boolean)
  for (const raw of toAdd || []) {
    const categoryKey = raw.categoryKey || raw.category
    const tagCode = raw.tagCode || raw.code
    if (!categoryKey || !tagCode) continue
    if (categoryKey === 'spiciness') {
      list = list.filter(t => t.categoryKey !== 'spiciness')
      list.push({ categoryKey, tagCode })
    } else if (!list.some(t => t.categoryKey === categoryKey && t.tagCode === tagCode)) {
      list.push({ categoryKey, tagCode })
    }
  }
  return list
}

function removeTagFromList(list, categoryKey, tagCode) {
  return (list || []).filter(
    t => !(t.categoryKey === categoryKey && t.tagCode === tagCode)
  )
}

function buildDishTagDisplaysByDishId(rows, currentUserId) {
  const byDishGroups = new Map()

  rows.forEach(r => {
    const d = r.dish_id
    if (!byDishGroups.has(d)) byDishGroups.set(d, new Map())
    const cm = byDishGroups.get(d)
    if (!cm.has(r.category)) cm.set(r.category, new Map())
    const tm = cm.get(r.category)
    if (!tm.has(r.tag_code)) tm.set(r.tag_code, [])
    tm.get(r.tag_code).push(r.nickname || '用户')
  })

  const myByDish = new Map()
  if (currentUserId) {
    rows.forEach(r => {
      if (r.user_id !== currentUserId) return
      const d = r.dish_id
      if (!myByDish.has(d)) myByDish.set(d, [])
      const list = myByDish.get(d)
      const exists = list.some(x => x.categoryKey === r.category && x.tagCode === r.tag_code)
      if (!exists) {
        list.push({
          categoryKey: r.category,
          tagCode: r.tag_code,
          tagLabel: getTagLabel(r.category, r.tag_code),
          colorKey: getCategoryMeta(r.category)?.colorKey || 'blue'
        })
      }
    })
  }

  const result = new Map()
  byDishGroups.forEach((catMap, dishId) => {
    const groups = []
    CATEGORIES.forEach(cat => {
      const tagMap = catMap.get(cat.key)
      if (!tagMap) return
      const items = []
      cat.tags.forEach(tdef => {
        const users = tagMap.get(tdef.code)
        if (users && users.length > 0) {
          items.push({ tagLabel: tdef.label, users })
        }
      })
      if (items.length > 0) {
        groups.push({
          categoryKey: cat.key,
          categoryLabel: cat.label,
          colorKey: cat.colorKey,
          items
        })
      }
    })
    result.set(dishId, {
      tagDisplay: {
        groups,
        myTags: myByDish.get(dishId) || []
      }
    })
  })

  myByDish.forEach((tags, dishId) => {
    if (!result.has(dishId)) {
      result.set(dishId, { tagDisplay: { groups: [], myTags: tags } })
    }
  })

  return result
}

module.exports = {
  CATEGORIES,
  isValidTag,
  getTagLabel,
  getCategoryMeta,
  buildDishTagDisplaysByDishId,
  parseTagsColumn,
  serializeTagsForDb,
  expandOrderRowsToTagRows,
  mergeTagsIntoList,
  removeTagFromList
}
