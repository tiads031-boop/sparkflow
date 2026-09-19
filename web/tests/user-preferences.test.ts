import assert from 'node:assert/strict';
import test from 'node:test';
import {
  DEFAULT_USER_PREFERENCES,
  readUserPreferences,
  resolvedAppearance,
} from '../src/utils/userPreferences.ts';

test('legacy preference fallback keeps appearance on system', () => {
  assert.equal(DEFAULT_USER_PREFERENCES.appearance, 'system');
  assert.equal(readUserPreferences().appearance, 'system');
});

test('appearance resolver keeps explicit light and dark choices', () => {
  assert.equal(resolvedAppearance('light'), 'light');
  assert.equal(resolvedAppearance('dark'), 'dark');
});

test('appearance resolver falls back to light outside a browser', () => {
  assert.equal(resolvedAppearance('system'), 'light');
});
