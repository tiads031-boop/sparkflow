import assert from 'node:assert/strict';
import test from 'node:test';
import {
  defaultNavOrder,
  defaultNavVisibility,
  isToggleableNavTab,
  migrateNavigationId,
  navigationRegistry,
} from '../src/navigation.ts';

test('legacy dashboard and calendar routes migrate to V5 routes', () => {
  assert.equal(migrateNavigationId('dashboard'), 'today');
  assert.equal(migrateNavigationId('calendar'), 'timeline');
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
