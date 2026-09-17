import assert from 'node:assert/strict';
import test from 'node:test';
import {
  ApiError,
  apiErrorContext,
  courseImportErrorMessage,
  parseApiServerMessage,
} from '../src/api/errors.ts';

test('keeps raw API response out of the user-facing error message', () => {
  const raw = JSON.stringify({ message: '课表备份格式无效或数据超出限制', statusCode: 400 });
  const error = new ApiError(400, parseApiServerMessage(raw));

  assert.equal(error.message, '提交内容无效，请检查后重试');
  assert.ok(!error.message.includes(raw));
  assert.equal(apiErrorContext(error), '课表备份格式无效或数据超出限制');
});

test('maps a legacy course import response to an actionable version message', () => {
  const error = new ApiError(400, '课表备份格式无效或数据超出限制');
  assert.equal(
    courseImportErrorMessage(error, 'preview'),
    '课程导入服务与当前 App 版本不匹配，请更新服务后重试',
  );
});

test('maps network failures without exposing implementation details', () => {
  assert.equal(
    courseImportErrorMessage(new TypeError('Failed to fetch'), 'preview'),
    '本地预览已生成，但无法连接课程导入服务，请检查网络后重试',
  );
});

test('parses validation message arrays for feature-level mapping', () => {
  assert.equal(
    parseApiServerMessage(JSON.stringify({ message: ['first', 'second'] })),
    'first；second',
  );
});
