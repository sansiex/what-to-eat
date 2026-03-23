/**
 * 将后端 tagDisplay 格式化为页面展示结构（含 usersText、rowKey）
 */
function formatTagView(tagDisplay) {
  const td = tagDisplay || { groups: [], myTags: [] }
  return {
    groups: (td.groups || []).map(g => ({
      categoryKey: g.categoryKey,
      categoryLabel: g.categoryLabel,
      colorKey: g.colorKey,
      items: (g.items || []).map(i => ({
        tagLabel: i.tagLabel,
        usersText: (i.users || []).join('、')
      }))
    })),
    myTags: (td.myTags || []).map(t => ({
      ...t,
      rowKey: `${t.categoryKey}_${t.tagCode}`
    }))
  }
}

module.exports = {
  formatTagView
}
