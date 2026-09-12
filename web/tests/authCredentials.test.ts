import assert from 'node:assert/strict';
import test from 'node:test';
import { nicknameToEmail, normalizeNickname, validateNickname } from '../src/auth/credentials.ts';

test('nickname normalization is case-insensitive and Unicode-stable', () => {
  assert.equal(normalizeNickname('  Ｆｉｓｈ_鱼  '), 'fish_鱼');
});

test('nickname validation accepts Chinese names and rejects spaces', () => {
  assert.equal(validateNickname('小鱼_031'), null);
  assert.match(validateNickname('a') ?? '', /2–24/);
  assert.match(validateNickname('two words') ?? '', /只能包含/);
});

test('nickname aliases are deterministic without exposing the nickname', async () => {
  const first = await nicknameToEmail('SparkFish');
  const second = await nicknameToEmail(' sparkfish ');
  assert.equal(first, second);
  assert.match(first, /^n_[a-f0-9]{52}@users\.fish-life\.cc\.cd$/);
  assert.equal(first.includes('sparkfish'), false);
});

