/**
 * 菜品列表页面测试
 */

describe('菜品列表页面测试', () => {
  test('页面文件存在', () => {
    const fs = require('fs')
    expect(fs.existsSync('pages/dish-list/dish-list.js')).toBe(true)
    expect(fs.existsSync('pages/dish-list/dish-list.wxml')).toBe(true)
    expect(fs.existsSync('pages/dish-list/dish-list.wxss')).toBe(true)
  })

  test('WXML包含图片与编辑能力', () => {
    const fs = require('fs')
    const wxml = fs.readFileSync('pages/dish-list/dish-list.wxml', 'utf-8')
    expect(wxml).toContain('showEditDialog')
    expect(wxml).toContain('chooseDishImage')
    expect(wxml).toContain('dish-image')
    expect(wxml).toContain('dish-desc')
  })

  test('JS包含新增字段和上传方法', () => {
    const fs = require('fs')
    const js = fs.readFileSync('pages/dish-list/dish-list.js', 'utf-8')
    expect(js).toContain('dishDescriptionInput')
    expect(js).toContain('dishImageUrl')
    expect(js).toContain('chooseDishImage')
    expect(js).toContain('submitDish')
    expect(js).toContain('showEditDialog')
  })
})
