/**
 * utils/dish-preview.js
 */

const {
  DISH_PLACEHOLDER_PATH,
  isDishPlaceholderUrl,
  previewSingleDishImage
} = require('../utils/dish-preview.js')

describe('dish-preview', () => {
  beforeEach(() => {
    global.wx = { previewImage: jest.fn() }
  })

  test('isDishPlaceholderUrl', () => {
    expect(isDishPlaceholderUrl(null)).toBe(true)
    expect(isDishPlaceholderUrl('')).toBe(true)
    expect(isDishPlaceholderUrl('  ')).toBe(true)
    expect(isDishPlaceholderUrl(DISH_PLACEHOLDER_PATH)).toBe(true)
    expect(isDishPlaceholderUrl('https://x.com/path/dish-placeholder.png')).toBe(true)
    expect(isDishPlaceholderUrl('https://cos.qq.com/abc.png')).toBe(false)
  })

  test('previewSingleDishImage 跳过占位图', () => {
    previewSingleDishImage(DISH_PLACEHOLDER_PATH)
    expect(wx.previewImage).not.toHaveBeenCalled()
  })

  test('previewSingleDishImage 真实地址调用 preview', () => {
    previewSingleDishImage('https://example.com/a.jpg')
    expect(wx.previewImage).toHaveBeenCalledWith({
      current: 'https://example.com/a.jpg',
      urls: ['https://example.com/a.jpg']
    })
  })
})
