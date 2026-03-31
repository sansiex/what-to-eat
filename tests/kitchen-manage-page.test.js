/**
 * 厨房管理页（Tab）
 */
describe('kitchen-manage 页面', () => {
  test('WXML：切换厨房、权限与邀请位置', () => {
    const fs = require('fs');
    const wxml = fs.readFileSync('pages/kitchen-manage/kitchen-manage.wxml', 'utf-8');

    expect(wxml).toContain('kitchen-switcher');
    expect(wxml).toContain('showBar="{{false}}"');
    expect(wxml).toContain('openKitchenPicker');
    expect(wxml).toContain('switch-kitchen-link');
    expect(wxml).toContain('section-title-row--kitchen-name');
    expect(wxml).toContain('kitchen-meta-row');
    expect(wxml).toContain('kitchen-meta-subtitle');
    expect(wxml).toContain('kitchen-meta-badge');
    expect(wxml).toContain('disabled="{{!isOwner}}"');
    expect(wxml).toContain('btn-invite-inline');
    expect(wxml).toContain('参与制定菜单');
    expect(wxml).toContain('邀请一位试试吧');
    expect(wxml).toContain('membersLoading');
    expect(wxml).toContain('list-loading-spinner');
  });

  test('kitchen-switcher：选择面板不含退出厨房入口', () => {
    const fs = require('fs');
    const wxml = fs.readFileSync('components/kitchen-switcher/kitchen-switcher.wxml', 'utf-8');
    expect(wxml).not.toContain('panel__leave');
    expect(wxml).not.toContain('leaveCurrentKitchen');
  });

  test('JS：主人判断与切换厨房', () => {
    const fs = require('fs');
    const js = fs.readFileSync('pages/kitchen-manage/kitchen-manage.js', 'utf-8');

    expect(js).toContain('isOwner');
    expect(js).toContain('openKitchenPicker');
    expect(js).toContain('bootstrapPage');
    expect(js).toContain('ensureAdminOwnerSubtitle');
  });
});
