import assert from 'node:assert/strict';
import test from 'node:test';
import { fixture } from './helpers.js';

const rule = (extra = {}) => ({ id: 'one', enabled: true, urlPattern: '^https://example\\.com/api$', resBody: '{"mock":true}', ...extra });

test('worker rejects malformed commands and releases traffic with corrupt stored rules', async () => {
  const f = fixture([rule({ method: 42 })]);
  await f.controller.startSession(1);
  assert.equal((await f.controller.respond({ type: 'SAVE_RULE', commandId: 'bad', rule: rule({ method: 42 }) })).ok, false);
  assert.equal(f.controller.repository.invalidCount, 1);
  await f.pause();
  assert.equal(f.commands.at(-1).method, 'Fetch.continueRequest');
  f.controller.dispose();
});

test('a failed rule load releases a paused request rather than leaving traffic pending', async () => {
  const f = fixture([], { getError: true });
  await assert.rejects(f.controller.startSession(1), /storage/);
  await f.pause();
  assert.equal(f.commands.at(-1).method, 'Fetch.continueRequest');
  assert.equal(f.commands.some((c) => c.method === 'attach'), false);
  f.controller.dispose();
});

test('ordinary responses continue before passive body capture', async () => {
  const f = fixture();
  await f.controller.startSession(1);
  await f.request();
  await f.pause();
  assert.equal(f.commands.at(-1).method, 'Fetch.continueRequest');
  assert.equal(f.commands.some((c) => c.method.endsWith('getResponseBody')), false);
  await f.response();
  await f.emit('Network.loadingFinished', { requestId: 'network-1' });
  assert.equal(f.requests().at(-1).resBody, '{"ok":true}');
  assert.equal(f.commands.at(-1).method, 'Network.getResponseBody');
  f.controller.dispose();
});

test('streams and oversized decompressed responses flow without body retrieval', async () => {
  const f = fixture();
  await f.controller.startSession(1);
  await f.request(); await f.pause();
  await f.response({ response: { status: 200, headers: { 'Content-Type': 'text/event-stream' } } });
  assert.equal(f.requests().at(-1).bodyUnavailable, 'stream');
  await f.emit('Network.loadingFinished', { requestId: 'network-1' });
  await f.request(); await f.response();
  await f.emit('Network.dataReceived', { requestId: 'network-1', dataLength: 300 * 1024, encodedDataLength: 100 });
  await f.emit('Network.loadingFinished', { requestId: 'network-1' });
  assert.equal(f.requests().at(-1).bodyUnavailable, 'large');
  assert.equal(f.commands.some((c) => c.method.endsWith('getResponseBody')), false);
  f.controller.dispose();
});

test('explicit mocks and network failures apply without waiting for upstream bodies', async () => {
  const f = fixture([rule()]);
  await f.controller.startSession(1); await f.request(); await f.pause();
  const fulfilled = f.commands.find((c) => c.method === 'Fetch.fulfillRequest');
  assert.equal(atob(fulfilled.params.body), '{"mock":true}');
  assert.equal(f.requests().at(-1).ruleApplied, true);
  assert.equal(f.requests().at(-1).bodyUnavailable, 'overridden');
  await f.emit('Network.loadingFinished', { requestId: 'network-1' });
  assert.equal(f.requests().length, 1);
  await f.controller.repository.save(rule({ blockRequest: true, blockType: 'network-fail' }));
  await f.pause();
  assert.equal(f.commands.at(-1).method, 'Fetch.failRequest');
  assert.equal(f.requests().at(-1).networkFailureApplied, true);
  assert.equal(f.commands.some((c) => c.method.endsWith('getResponseBody')), false);
  f.controller.dispose();
});

test('status-only binary overrides omit body and preserve encoding headers', async () => {
  const f = fixture([rule({ resBody: null, statusCode: 201 })]);
  await f.controller.startSession(1);
  await f.pause({ resourceType: 'Image', responseHeaders: [{ name: 'Content-Type', value: 'image/png' }, { name: 'Content-Encoding', value: 'gzip' }] });
  const params = f.commands.at(-1).params;
  assert.equal(Object.hasOwn(params, 'body'), false);
  assert.equal(params.responseCode, 201);
  assert.ok(params.responseHeaders.some((h) => h.name === 'Content-Encoding'));
  f.controller.dispose();
});

test('failed fulfillment continues upstream traffic and does not claim the rule applied', async () => {
  const f = fixture([rule()], { rejectCommand: 'Fetch.fulfillRequest' });
  await f.controller.startSession(1); await f.pause();
  assert.equal(f.commands.at(-1).method, 'Fetch.continueRequest');
  assert.equal(f.requests().length, 0);
  assert.equal(f.messages.at(-1).type, 'ERROR');
  f.controller.dispose();
});

test('failed initialization rolls back attach; failed disable still attempts detach', async () => {
  const f = fixture([], { rejectCommand: 'Fetch.enable' });
  await assert.rejects(f.controller.startSession(1), /command/);
  assert.equal(f.commands.at(-1).method, 'detach');
  const g = fixture([], { rejectCommand: 'Fetch.disable' });
  await g.controller.startSession(1); await g.controller.stopSession(1);
  assert.equal(g.commands.at(-1).method, 'detach');
  await g.pause();
  assert.equal(g.commands.at(-1).method, 'Fetch.continueRequest');
  f.controller.dispose(); g.controller.dispose();
});

test('when cleanup fails, late pauses are continued and Stop retries', async () => {
  const options = { rejectCommand: 'Fetch.disable', detachError: true };
  const f = fixture([], options);
  await f.controller.startSession(1);
  await assert.rejects(f.controller.stopSession(1), /stop/);
  await f.pause();
  assert.equal(f.commands.at(-1).method, 'Fetch.continueRequest');
  options.detachError = false;
  await f.controller.stopSession(1);
  assert.equal((await f.controller.respond({ type: 'GET_RULES' })).activeSessions.length, 0);
  f.controller.dispose();
});

test('disconnect grace allows reconnect, stale ports cannot remove new ports, final close stops capture', async () => {
  const f = fixture(); await f.controller.startSession(1);
  const replacement = f.connect();
  f.port.onDisconnect.emit(); await f.runTimers();
  assert.equal(f.commands.some((c) => c.method === 'detach'), false);
  replacement.onDisconnect.emit();
  const reconnected = f.connect(); await f.runTimers();
  assert.equal(f.commands.some((c) => c.method === 'detach'), false);
  reconnected.onDisconnect.emit(); await f.runTimers();
  assert.equal(f.commands.at(-1).method, 'detach');
  f.controller.dispose();
});

test('upstream failures are visible and explicit mocks can replace them', async () => {
  const f = fixture(); await f.controller.startSession(1); await f.request();
  await f.emit('Network.loadingFailed', { requestId: 'network-1', errorText: 'net::ERR_CONNECTION_REFUSED' });
  assert.equal(f.requests().at(-1).responseErrorReason, 'net::ERR_CONNECTION_REFUSED');
  await f.controller.repository.save(rule());
  await f.pause({ responseStatusCode: undefined, responseErrorReason: 'ConnectionRefused' });
  assert.equal(f.commands.at(-1).method, 'Fetch.fulfillRequest');
  assert.equal(f.requests().at(-1).ruleApplied, true);
  f.controller.dispose();
});

test('early Network completion waits for fulfillment metadata and does not publish synthetic body as original', async () => {
  let complete;
  const options = { onCommand: (method) => method === 'Fetch.fulfillRequest' ? new Promise((resolve) => { complete = resolve; }) : undefined };
  const f = fixture([rule()], options); await f.controller.startSession(1); await f.request();
  const paused = f.pause();
  await new Promise((resolve) => setImmediate(resolve));
  const finished = f.emit('Network.loadingFinished', { requestId: 'network-1' });
  complete(); await Promise.all([paused, finished]);
  assert.equal(f.requests().length, 1);
  assert.equal(f.requests()[0].ruleApplied, true);
  assert.equal(f.commands.some((c) => c.method.endsWith('getResponseBody')), false);
  f.controller.dispose();
});

test('worker serializes concurrent lifecycle actions', async () => {
  const f = fixture();
  await Promise.all([f.controller.startSession(1), f.controller.startSession(1), f.controller.stopSession(1)]);
  assert.equal(f.commands.filter((c) => c.method === 'attach').length, 1);
  assert.equal(f.commands.filter((c) => c.method === 'detach').length, 1);
  f.controller.dispose();
});

test('external detach suppresses a body read that was already in flight', async () => {
  let release;
  const gate = new Promise(resolve => { release = resolve; });
  const f = fixture([], { onCommand: async method => { if (method === 'Network.getResponseBody') await gate; } });
  await f.controller.startSession(1);
  await f.request(); await f.response();
  const finished = f.emit('Network.loadingFinished', { requestId: 'network-1' });
  await new Promise(resolve => setImmediate(resolve));
  f.chrome.debugger.onDetach.emit({ tabId: 1 });
  release();
  await finished;
  assert.equal(f.requests().length, 0);
  assert.equal((await f.controller.respond({ type: 'GET_RULES' })).activeSessions.length, 0);
  f.controller.dispose();
});

test('body-filter matching uses the bounded request preview', async () => {
  const f = fixture([rule({ bodyContains:'outside-preview' })]);
  await f.controller.startSession(1);
  await f.pause({request:{url:'https://example.com/api',method:'POST',headers:{},postData:'a'.repeat(64*1024)+'outside-preview'}});
  assert.equal(f.commands.at(-1).method, 'Fetch.continueRequest');
  f.controller.dispose();
});
