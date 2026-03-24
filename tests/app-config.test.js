/**
 * App配置测试
 * Tab：【菜单】（含菜品入口）【点餐】【厨房】
 */

const fs = require('fs');
const path = require('path');

describe('App配置测试 - Tab页', () => {
  let appConfig;

  beforeAll(() => {
    const configPath = path.join(__dirname, '../app.json');
    const configContent = fs.readFileSync(configPath, 'utf-8');
    appConfig = JSON.parse(configContent);
  });

  test('验证tabBar配置存在', () => {
    expect(appConfig.tabBar).toBeDefined();
    expect(appConfig.tabBar.list).toBeDefined();
    expect(Array.isArray(appConfig.tabBar.list)).toBe(true);
  });

  test('验证tabBar包含3个tab项', () => {
    expect(appConfig.tabBar.list).toHaveLength(3);
  });

  test('验证第一个tab是【菜单】', () => {
    const firstTab = appConfig.tabBar.list[0];
    expect(firstTab.text).toBe('菜单');
    expect(firstTab.pagePath).toBe('pages/menu-list/menu-list');
  });

  test('验证第二个tab是【点餐】', () => {
    const secondTab = appConfig.tabBar.list[1];
    expect(secondTab.text).toBe('点餐');
    expect(secondTab.pagePath).toBe('pages/meal-list/meal-list');
  });

  test('验证第三个tab是【厨房】', () => {
    const thirdTab = appConfig.tabBar.list[2];
    expect(thirdTab.text).toBe('厨房');
    expect(thirdTab.pagePath).toBe('pages/kitchen-manage/kitchen-manage');
  });

  test('验证pages配置包含菜品列表页（非Tab）', () => {
    expect(appConfig.pages).toContain('pages/dish-list/dish-list');
  });

  test('验证pages配置包含所有必要页面', () => {
    const requiredPages = [
      'pages/login/login',
      'pages/menu-list/menu-list',
      'pages/dish-list/dish-list',
      'pages/meal-list/meal-list',
      'pages/menu-edit/menu-edit'
    ];

    requiredPages.forEach(page => {
      expect(appConfig.pages).toContain(page);
    });
  });

  test('验证tabBar样式配置正确', () => {
    expect(appConfig.tabBar.color).toBeDefined();
    expect(appConfig.tabBar.selectedColor).toBeDefined();
    expect(appConfig.tabBar.backgroundColor).toBeDefined();
  });
});
