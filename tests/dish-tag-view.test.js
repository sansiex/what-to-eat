const { formatTagView } = require('../utils/dish-tag-view.js')

describe('dish-tag-view', () => {
  test('formatTagView 生成 usersText 与 rowKey', () => {
    const v = formatTagView({
      groups: [
        {
          categoryKey: 'spiciness',
          categoryLabel: '辣度',
          colorKey: 'red',
          items: [{ tagLabel: '不辣', users: ['a', 'b'] }]
        }
      ],
      myTags: [{ categoryKey: 'taboo', tagCode: 'no_cilantro', tagLabel: '不要香菜', colorKey: 'blue' }]
    })
    expect(v.groups[0].items[0].usersText).toBe('a、b')
    expect(v.myTags[0].rowKey).toBe('taboo_no_cilantro')
  })
})
