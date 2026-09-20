import assert from 'node:assert/strict';
import test from 'node:test';
import {
  defaultNavOrder,
  defaultNavVisibility,
  isToggleableNavTab,
  migrateNavigationId,
  navigationRegistry,
  workspaceNavigationRegistry,
  workspaceTabForRoute,
} from '../src/navigation.ts';

test('legacy dashboard and calendar routes migrate to V5 routes', () => {
  assert.equal(migrateNavigationId('dashboard'), 'today');
  assert.equal(migrateNavigationId('calendar'), 'today');
});

test('unknown navigation ids are rejected without hiding future registered items', () => {
  assert.equal(migrateNavigationId('unknown-route'), null);
  assert.equal(isToggleableNavTab(migrateNavigationId('settings')), false);
});

test('Phase 15 defaults expose records as a primary destination', () => {
  const visible = navigationRegistry.filter((item) =>
    item.id === 'settings' || (item.toggleable && defaultNavVisibility[item.id]),
  );
  assert.deepEqual(visible.map((item) => item.id), ['today', 'timeline', 'tasks', 'courses', 'sparks', 'settings']);
  assert.deepEqual(defaultNavOrder.slice(0, 5), ['today', 'timeline', 'tasks', 'courses', 'sparks']);
  assert.equal(defaultNavVisibility.board, false);
  assert.equal(defaultNavVisibility.sparks, true);
  assert.equal(defaultNavVisibility.study, false);
  assert.equal(migrateNavigationId('study'), 'study');
});


test('VNext workspace navigation is fixed to five user-facing destinations', () => {
  assert.deepEqual(
    workspaceNavigationRegistry.map((item) => item.id),
    ['today', 'plan', 'records', 'study', 'profile'],
  );
  assert.deepEqual(
    workspaceNavigationRegistry.map((item) => item.label),
    ['日程', '待办', '记录', '学习', '我的'],
  );
});

test('legacy routes resolve into the matching VNext workspace without deleting compatibility ids', () => {
  assert.equal(workspaceTabForRoute('timeline'), 'today');
  assert.equal(workspaceTabForRoute('tasks'), 'plan');
  assert.equal(workspaceTabForRoute('board'), 'plan');
  assert.equal(workspaceTabForRoute('calendar'), 'today');
  assert.equal(workspaceTabForRoute('sparks'), 'records');
  assert.equal(workspaceTabForRoute('courses'), 'study');
  assert.equal(workspaceTabForRoute('settings'), 'profile');
  assert.equal(workspaceTabForRoute('unknown-route'), null);

  assert.equal(migrateNavigationId('calendar'), 'today');
  assert.equal(migrateNavigationId('courses'), 'courses');
});
