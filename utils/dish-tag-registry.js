/**
 * 菜品标签定义（与云函数 meal/utils、order/utils 下 tag-registry.js 保持一致，供前端展示与级联选择器）
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

module.exports = {
  CATEGORIES
}
