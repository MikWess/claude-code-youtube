import assert from 'node:assert/strict';
import test from 'node:test';
import { parseChatBody, parsePermissionBody, submitPermission } from '../src/api-contract.ts';

test('malformed chat inputs are rejected before an SDK request', () => {
  for (const body of [null, {}, {messages: []}, {messages: [{role: 1, text: 'hi'}]}, {messages: [{role: 'system', text: 'hi'}]}]) {
    assert.throws(() => parseChatBody(body));
  }
  assert.deepEqual(parseChatBody({messages: [{role: 'user', text: 'hello'}]}), [{role: 'user', text: 'hello'}]);
});
test('permission decisions require an actual boolean', () => {
  for (const allow of ['false', 'true', 1, null, undefined]) assert.throws(() => parsePermissionBody({requestId: 'p', allow}));
  assert.deepEqual(parsePermissionBody({requestId: 'p', allow: false}), {requestId: 'p', allow: false});
});
test('failed permission submissions reject so the UI can retain its pending decision', async () => {
  await assert.rejects(submitPermission('p', false, async () => Response.json({error: 'Try again'}, {status: 503})), /Try again/);
  await assert.rejects(submitPermission('p', false, async () => { throw new Error('offline'); }), /offline/);
  await submitPermission('p', false, async (_url, init) => {
    assert.equal(JSON.parse(init.body).allow, false);
    return Response.json({ok: true});
  });
});
