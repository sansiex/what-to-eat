const {
  mergeTagsIntoList,
  removeTagFromList,
  expandOrderRowsToTagRows,
  parseTagsColumn
} = require('../functions/meal/utils/tag-registry')

describe('tag-registry JSON helpers', () => {
  test('mergeTagsIntoList 辣度互斥', () => {
    const a = mergeTagsIntoList(
      [{ categoryKey: 'spiciness', tagCode: 'mild' }],
      [{ categoryKey: 'spiciness', tagCode: 'hot' }]
    )
    expect(a).toEqual([{ categoryKey: 'spiciness', tagCode: 'hot' }])
  })

  test('mergeTagsIntoList 忌口可叠加去重', () => {
    const a = mergeTagsIntoList(
      [{ categoryKey: 'taboo', tagCode: 'no_cilantro' }],
      [{ categoryKey: 'taboo', tagCode: 'no_garlic' }, { categoryKey: 'taboo', tagCode: 'no_cilantro' }]
    )
    expect(a).toHaveLength(2)
  })

  test('removeTagFromList', () => {
    const a = removeTagFromList(
      [
        { categoryKey: 'taboo', tagCode: 'no_cilantro' },
        { categoryKey: 'spiciness', tagCode: 'mild' }
      ],
      'taboo',
      'no_cilantro'
    )
    expect(a).toEqual([{ categoryKey: 'spiciness', tagCode: 'mild' }])
  })

  test('expandOrderRowsToTagRows', () => {
    const rows = expandOrderRowsToTagRows([
      {
        dish_id: 10,
        user_id: 2,
        nickname: '甲',
        tags: JSON.stringify([
          { categoryKey: 'spiciness', tagCode: 'none' },
          { categoryKey: 'taboo', tagCode: 'no_cilantro' }
        ])
      }
    ])
    expect(rows).toHaveLength(2)
    expect(rows[0]).toMatchObject({ dish_id: 10, category: 'spiciness', tag_code: 'none', user_id: 2 })
  })

  test('parseTagsColumn 空', () => {
    expect(parseTagsColumn(null)).toEqual([])
    expect(parseTagsColumn('')).toEqual([])
  })
})
