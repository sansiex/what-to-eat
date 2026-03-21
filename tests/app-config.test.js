/**
 * App配置测试
 * 测试驱动开发 - 验证tab页重构
 * Tab页应包含：【菜单】，【菜品】，【点餐】，【厨房】
 */

const fs = require('fs');
const path = require('path');

describe('App配置测试 - Tab页重构', () => {
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

  test('验证tabBar包含4个tab项', () => {
    expect(appConfig.tabBar.list).toHaveLength(4);
  });

  test('验证第一个tab是【菜单】', () => {
    const firstTab = appConfig.tabBar.list[0];
    expect(firstTab.text).toBe('菜单');
    expect(firstTab.pagePath).toBe('pages/menu-list/menu-list');
  });

  test('验证第二个tab是【菜品】', () => {
    const secondTab = appConfig.tabBar.list[1];
    expect(secondTab.text).toBe('菜品');
    expect(secondTab.pagePath).toBe('pages/dish-list/dish-list');
  });

  test('验证第三个tab是【点餐】', () => {
    const thirdTab = appConfig.tabBar.list[2];
    expect(thirdTab.text).toBe('点餐');
    expect(thirdTab.pagePath).toBe('pages/meal-list/meal-list');
  });

  test('验证第四个tab是【厨房】', () => {
    const fourthTab = appConfig.tabBar.list[3];
    expect(fourthTab.text).toBe('厨房');
    expect(fourthTab.pagePath).toBe('pages/kitchen-manage/kitchen-manage');
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
