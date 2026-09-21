import assert from 'node:assert/strict';
import test from 'node:test';
import { isExplicitApplyAllMessage } from '../src/components/planner/planningConfirmation.ts';

test('treats a plain confirmation as applying the pending draft', () => {
  for (const message of ['确定', '确认', '同意', '确认，全部执行']) {
    assert.equal(isExplicitApplyAllMessage(message), true);
  }
});

test('does not mistake a new instruction for confirmation', () => {
  assert.equal(isExplicitApplyAllMessage('永久删除，30天训练先不管'), false);
  assert.equal(isExplicitApplyAllMessage('先修改时间'), false);
});
