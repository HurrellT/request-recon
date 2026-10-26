import assert from 'node:assert/strict';
import test from 'node:test';
import { createCommandClient } from '../src/lib/command-client.js';

test('commands only resolve after their matching persistence acknowledgement', async () => {
  const messages = [], replies = [], errors = [];
  const client = createCommandClient({ onReply: (reply) => replies.push(reply), onError: (error) => errors.push(error) });
  client.setPort({ postMessage: (message) => messages.push(message) });
  let resolved = false;
  const task = client.send({ type: 'SAVE_RULE' }).then(() => { resolved = true; });
  await Promise.resolve(); assert.equal(resolved, false);
  client.receive({ type: 'RESULT', commandId: 'other', ok: true });
  assert.equal(resolved, false);
  client.receive({ type: 'RESULT', commandId: messages[0].commandId, ok: true, rules: [] });
  await task; assert.equal(resolved, true); assert.equal(replies.length, 1);
  const failed = client.send({ type: 'SAVE_RULE' });
  client.receive({ type: 'RESULT', commandId: messages[1].commandId, ok: false, params: { details: 'quota' } });
  await assert.rejects(failed, /quota/); assert.equal(errors.length, 1);
  client.disconnect();
});

test('disconnected commands reject and disconnect rejects in-flight commands', async () => {
  const client = createCommandClient();
  await assert.rejects(client.send({ type: 'SAVE_RULE' }), /unavailable/);
  client.setPort({ postMessage() {} });
  const pending = client.send({ type: 'IMPORT_RULES' });
  client.disconnect();
  await assert.rejects(pending, /unavailable/);
});
