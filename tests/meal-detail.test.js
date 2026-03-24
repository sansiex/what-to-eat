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
    expect(wxml).toContain('previewDishImage');
    expect(wxml).toContain('data-url="{{item.displayImage}}"');
    expect(wxml).toContain('toggleDishExpand');
    expect(wxml).toContain('dish-tag-pill');
    expect(wxml).toContain('dish-tag-corner-badge');
    expect(wxml).toContain('hasTagBadge');
    expect(wxml).toContain('dish-item--has-tag-badge');
    expect(wxml).toContain('【TAG】');
    expect(wxml).toContain('用餐时间');
    expect(wxml).toContain('formattedScheduledMeal');
  });

  test('WXML：厨房成员可见删除', () => {
    const fs = require('fs');
    const wxml = fs.readFileSync('pages/meal-detail/meal-detail.wxml', 'utf-8');

    expect(wxml).toContain('header-delete-icon');
    expect(wxml).toContain('bindtap="deleteMeal"');
    expect(wxml).toContain('isKitchenMember');
  });

  test('JS：无已点时展开未点区与切换方法', () => {
    const fs = require('fs');
    const js = fs.readFileSync('pages/meal-detail/meal-detail.js', 'utf-8');

    expect(js).toContain('toggleUnorderedSection');
    expect(js).toContain('unorderedSectionExpanded: false');
    expect(js).toMatch(/unorderedSectionExpanded\s*=\s*orderedDishes\.length === 0 && unorderedDishes\.length > 0/);
    expect(js).toContain('deleteMeal');
    expect(js).toContain('API.meal.delete');
    expect(js).toContain('previewDishImage');
    expect(js).toContain('isDishPlaceholderUrl');
    expect(js).toContain('dishHasTagBadge');
    expect(js).toContain('hasTagBadge');
    expect(js).toContain('formatScheduledMealDisplayForOrderFood');
    expect(js).toContain('formattedScheduledMeal');
    expect(js).toContain('requestMealOrderNotifySubscribe');
  });

  test('WXSS：折叠头部样式', () => {
    const fs = require('fs');
    const wxss = fs.readFileSync('pages/meal-detail/meal-detail.wxss', 'utf-8');

    expect(wxss).toMatch(/\.section-header-collapsible/);
    expect(wxss).toMatch(/\.dish-tag-corner-badge/);
    expect(wxss).toMatch(/\.dish-item--has-tag-badge/);
    expect(wxss).toMatch(/\.meal-scheduled-line/);
    expect(wxss).toMatch(/\.meal-scheduled-line\s*\{[^}]*#000000/);
  });
});
