import assert from 'node:assert/strict';
import test from 'node:test';
import { validateRule, validateRules, parseRulesFile, exportRules } from '../src/lib/rules.js';
import { findActiveRule, ruleMatchesRequest } from '../src/lib/rule-matcher.js';
import { urlToPattern } from '../src/lib/request-utils.js';
import { decodeCapturedBody, encodeBody } from '../src/lib/capture.js';
import { fixture } from './helpers.js';
const rule = (extra = {}) => ({ id: 'one', urlPattern: 'example\\.com/api', enabled: true, resBody: 'original', ...extra });

test('validates rules at every persistence boundary', () => {
  for (const extra of [ { method: 42 }, { enabled: 'true' }, { bodyContains: 3 }, { statusCode: 999 }, { statusCode: 100 }, { statusCode: 201.5 }, { resBody: {} }, { resHeaders: [{ name: 'X-Test', value: 'bad\r\nInjected: yes' }] }, { blockType: 'other' }, { resBody: 'a'.repeat(1024 * 1024 + 1) }, { urlPattern: '[' }, { urlPattern: '(?=api)' }, { urlPattern: '(a)\\1' } ]) assert.throws(() => validateRule(rule(extra)), JSON.stringify(Object.keys(extra)));
  assert.throws(() => validateRules([rule(), rule()]));
  assert.throws(() => validateRule({ enabled: true }));
  assert.throws(() => validateRules(Array.from({ length: 501 }, (_, i) => rule({ id: String(i) }))));
});

test('versioned exports and legacy files round-trip through the same schema', () => {
  const value = validateRule(rule({ url: 'https://example.com/api', resHeaders: [{ name: 'X-Test', value: 'yes' }] }));
  assert.deepEqual(parseRulesFile(exportRules([value])), [value]);
  assert.deepEqual(parseRulesFile(JSON.stringify([value])), [value]);
  assert.deepEqual(parseRulesFile(JSON.stringify(value)), [value]);
  assert.throws(() => parseRulesFile('{"format":"request-recon-rules","version":2,"rules":[]}'));
});

test('nested-quantifier patterns are handled without native backtracking and invalid patterns never become substrings', () => {
  assert.equal(ruleMatchesRequest(rule({ urlPattern: '(a+)+$' }), { url: 'https://example.com/' + 'a'.repeat(3000) + '!', method: 'GET' }), false);
  assert.equal(ruleMatchesRequest(rule({ urlPattern: '[' }), { url: 'https://example.com/[', method: 'GET' }), false);
});

test('generated endpoint patterns keep origin/path boundaries and permit query changes', () => {
  const r = rule({ urlPattern: urlToPattern('https://example.com/api/users') });
  for (const url of ['https://example.com/api/users', 'https://example.com/api/users?filter=active']) assert.equal(ruleMatchesRequest(r, { url }), true);
  for (const url of ['https://example.com/api/users-admin', 'https://other.example/?next=https://example.com/api/users']) assert.equal(ruleMatchesRequest(r, { url }), false);
  assert.equal(findActiveRule([rule({ enabled: false }), rule({ id: 'two' })], { url: 'https://example.com/api' }).id, 'two');
});

test('concurrent saves/toggles/delete compose rather than overwriting snapshots', async () => {
  const f = fixture();
  const r = f.controller.repository;
  await Promise.all([r.save(rule()), r.save(rule({ id: 'two' }))]);
  assert.equal(f.getRules().length, 2);
  await Promise.all([r.toggle('one', false), r.save(rule({ id: 'two', name: 'updated' })), r.remove('two')]);
  assert.equal(f.getRules().length, 1);
  assert.equal(f.getRules()[0].enabled, false);
  f.controller.dispose();
});

test('imports preserve ordering, disable all incoming rules and never overwrite colliding IDs', async () => {
  const f = fixture([rule()]);
  await f.controller.repository.import([rule({ resBody: 'imported' }), rule({ id: 'two' })]);
  const saved = f.getRules();
  assert.equal(saved.length, 3);
  assert.equal(saved[0].enabled, false);
  assert.notEqual(saved[0].id, 'one');
  assert.equal(saved[1].id, 'two');
  assert.equal(saved[1].enabled, false);
  assert.equal(saved[2].resBody, 'original');
  assert.equal(saved[2].enabled, true);
  f.controller.dispose();
});

test('failed writes return failure acknowledgements and leave persisted rules unchanged', async () => {
  const f = fixture([rule()], { setError: true });
  const reply = await f.controller.respond({ type: 'SAVE_RULE', commandId: 'save', rule: rule({ resBody: 'new' }) });
  assert.equal(reply.commandId, 'save'); assert.equal(reply.ok, false);
  assert.equal(f.getRules()[0].resBody, 'original');
  f.controller.dispose();
});

test('body previews handle charsets and large/invalid data without changing override bytes', () => {
  assert.equal(decodeCapturedBody({ body: btoa('\xe9'), base64Encoded: true }, [{ name: 'Content-Type', value: 'text/plain; charset=iso-8859-1' }]).resBody, 'é');
  assert.equal(decodeCapturedBody({ body: btoa('\x89PNG'), base64Encoded: true }, []).bodyUnavailable, 'binary');
  assert.equal(decodeCapturedBody({ body: 'a'.repeat(300 * 1024), base64Encoded: false }, []).bodyUnavailable, 'large');
  assert.equal(new TextDecoder().decode(Uint8Array.from(atob(encodeBody('你好')), (c) => c.charCodeAt(0))), '你好');
});

test('stored rule count and total size are bounded with an invalid-state warning', async () => {
  const excess = fixture(Array.from({length:501}, (_,i) => ({id:`rule-${i}`, enabled:false, urlPattern:'.*'})));
  assert.equal((await excess.controller.repository.load()).length, 500);
  assert.equal(excess.controller.repository.invalidCount, 1);
  excess.controller.dispose();
  const oversized = fixture(Array.from({length:9}, (_,i) => ({id:`large-${i}`, enabled:true, urlPattern:'.*', resBody:'a'.repeat(1024 * 1024)})));
  assert.deepEqual(await oversized.controller.repository.load(), []);
  assert.equal(oversized.controller.repository.invalidCount, 9);
  oversized.controller.dispose();
});

test('saving a complete rule clears removed optional filters and preserves creation metadata', async () => {
  const f = fixture([rule({createdAt:'2020-01-01', operationName:'Old', bodyContains:'old', statusCode:503})]);
  const [saved] = await f.controller.repository.save(rule({operationName:null, bodyContains:null}));
  assert.equal(saved.operationName, undefined);
  assert.equal(saved.bodyContains, undefined);
  assert.equal(saved.statusCode, undefined);
  assert.equal(saved.createdAt, '2020-01-01');
  f.controller.dispose();
});
