/**
 * 点餐详情页
 */

describe('meal-detail 页面', () => {
  test('WXML：未点菜品可折叠', () => {
    const fs = require('fs');
    const wxml = fs.readFileSync('pages/meal-detail/meal-detail.wxml', 'utf-8');

    expect(wxml).toContain('toggleUnorderedSection');
    expect(wxml).toContain('unorderedSectionExpanded');
    expect(wxml).toContain('section-header-collapsible');
  });

  test('WXML：厨房成员可见删除', () => {
    const fs = require('fs');
    const wxml = fs.readFileSync('pages/meal-detail/meal-detail.wxml', 'utf-8');

    expect(wxml).toContain('header-delete-icon');
    expect(wxml).toContain('bindtap="deleteMeal"');
    expect(wxml).toContain('isKitchenMember');
  });

  test('JS：默认折叠与切换方法', () => {
    const fs = require('fs');
    const js = fs.readFileSync('pages/meal-detail/meal-detail.js', 'utf-8');

    expect(js).toContain('toggleUnorderedSection');
    expect(js).toContain('unorderedSectionExpanded: false');
    expect(js).toContain('deleteMeal');
    expect(js).toContain('API.meal.delete');
  });

  test('WXSS：折叠头部样式', () => {
    const fs = require('fs');
    const wxss = fs.readFileSync('pages/meal-detail/meal-detail.wxss', 'utf-8');

    expect(wxss).toMatch(/\.section-header-collapsible/);
  });
});
