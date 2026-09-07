import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from '../web/node_modules/typescript/lib/typescript.js';

// Execute the actual slice with only the network and storage boundaries stubbed.
const source = readFileSync(new URL('../web/src/store/authSlice.ts', import.meta.url), 'utf8');
const js = ts.transpile(source, { target: ts.ScriptTarget.ES2023, module: ts.ModuleKind.CommonJS });
function setup(signUp, configured = true) {
  const module = { exports: {} };
  const dependencies = {
    '../api/supabase': { isSupabaseConfigured: configured, supabase: { auth: { signUp } } },
    './coursePreferences': { useCoursePreferences: { getState: () => ({ bindUser() {} }) } },
  };
  new Function('require', 'exports', 'module', js)((id) => {
    assert.ok(id in dependencies, `Unexpected dependency: ${id}`);
    return dependencies[id];
  }, module.exports, module);
  let state;
  state = module.exports.createAuthSlice((patch) => Object.assign(state, patch), () => state);
  return state;
}

let resolveSignup;
let calls = 0;
const state = setup(() => {
  calls++;
  return new Promise((resolve) => { resolveSignup = resolve; });
});
const first = state.register(' Test@Example.com ', 'test-password');
assert.equal(state.registrationPending, true);
assert.equal(await state.register('test@example.com', 'test-password'), false);
assert.equal(calls, 1, 'Concurrent submits must make only one signup request');
resolveSignup({ data: { user: { id: 'test-user' }, session: null }, error: null });
assert.equal(await first, false);
assert.equal(state.registrationPending, false);
assert.equal(state.isAuthenticated, false, 'Email verification must not be bypassed');
assert.match(state.registrationError, /确认邮件已发送/);
await state.register('TEST@example.com', 'test-password');
assert.equal(calls, 1, 'A pending verification must not send another signup email');

for (const [error, expected] of [
  [{ message: 'Database error saving new user', code: 'unexpected_failure' }, /账号保存失败/],
  [{ message: 'email rate limit exceeded' }, /服务限额/],
  [{ message: 'Email quota', code: 'over_email_send_rate_limit' }, /服务限额/],
  [{ message: 'Too many requests', code: 'over_request_rate_limit' }, /操作过于频繁/],
]) {
  const failed = setup(async () => ({ data: {}, error }));
  assert.equal(await failed.register('test@example.com', 'test-password'), false);
  assert.match(failed.registrationError, expected);
  assert.equal(failed.registrationPending, false);
  assert.equal(failed.isAuthenticated, false);
}

let attempts = 0;
const retry = setup(async () => {
  if (++attempts === 1) throw new TypeError('Failed to fetch');
  return { data: { user: { id: 'test-user' }, session: null }, error: null };
});
assert.equal(await retry.register('test@example.com', 'test-password'), false);
assert.match(retry.registrationError, /检查网络/);
assert.equal(retry.registrationPending, false);
await retry.register('test@example.com', 'test-password');
assert.equal(attempts, 2, 'A failed request must allow retry');
assert.match(retry.registrationError, /确认邮件已发送/);

const unconfigured = setup(() => assert.fail('Unconfigured signup must not call the network'), false);
assert.equal(await unconfigured.register('test@example.com', 'test-password'), false);
assert.match(unconfigured.registrationError, /尚未配置/);
console.log('PASS: duplicate signup prevention, verification notice, rate limits, database errors, network retry, configuration');
