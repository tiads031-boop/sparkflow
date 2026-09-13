import assert from 'node:assert/strict';
import test from 'node:test';
import { authErrorMessage } from '../src/auth/errors.ts';

test('does not misreport a missing request body as a short password', () => {
  const response = JSON.stringify({
    message: [
      'method must be one of the following values: nickname, email',
      'identifier must be a string',
      'password must be longer than or equal to 6 characters',
      'password must be a string',
    ],
    error: 'Bad Request',
    statusCode: 400,
  });

  assert.equal(authErrorMessage(`API 400: ${response}`, 'nickname'), '提交内容无效，请刷新页面后重试');
});

test('keeps the specific minimum password message', () => {
  const response = JSON.stringify({
    message: ['password must be longer than or equal to 6 characters'],
    error: 'Bad Request',
    statusCode: 400,
  });

  assert.equal(authErrorMessage(`API 400: ${response}`, 'nickname'), '密码至少需要 6 个字符');
});
