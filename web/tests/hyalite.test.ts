import assert from 'node:assert/strict';
import test from 'node:test';
import { hyaliteOptionsFor, supportsHyalite } from '../src/lib/hyalite.ts';

test('glass motion is disabled when reduce motion is enabled', () => {
  assert.equal(hyaliteOptionsFor('nav', true).materialize, 0);
  assert.equal(hyaliteOptionsFor('nav', false).materialize, 180);
});

test('low-power mode removes expensive chromatic dispersion', () => {
  assert.equal(hyaliteOptionsFor('preview', false, true).dispersion, 0);
  assert.equal(hyaliteOptionsFor('preview', false, false).dispersion, 0.42);
});

test('Hyalite support safely falls back outside a browser', () => {
  assert.equal(supportsHyalite(), false);
});
