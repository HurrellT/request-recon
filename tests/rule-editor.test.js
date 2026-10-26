import test from "node:test";
import assert from "node:assert/strict";
import { initialRuleDraft, ruleFromDraft } from "../src/panel/rule-editor/draft.js";
import { buildRuleDiagnostics } from "../src/panel/rule-editor/diagnostics.js";

const request = {
  id: "request-1",
  url: "https://example.com/api/users",
  method: "POST",
  reqBody: '{"userId":42}',
  resStatus: 200,
  resBody: '{"ok":true}',
  graphql: null,
};

test("rule drafts prefer saved values and use the captured request as a fallback", () => {
  const fromRequest = initialRuleDraft(null, request);
  assert.equal(fromRequest.name, "/api/users");
  assert.equal(fromRequest.method, "POST");
  assert.equal(fromRequest.bodyContains, '"userId":42');
  assert.equal(fromRequest.responseBody, '{"ok":true}');

  const fromRule = initialRuleDraft({ name: "Saved", bodyContains: "", resBody: "", blockRequest: true }, request);
  assert.equal(fromRule.name, "Saved");
  assert.equal(fromRule.bodyContains, "");
  assert.equal(fromRule.responseBody, "");
  assert.equal(fromRule.blockRequest, true);
});

test("saving a draft keeps HTTP and network error modes distinct", () => {
  const draft = { ...initialRuleDraft(null, request), blockRequest: true, blockStatus: "503", statusCode: "201", enabled: false };
  const httpRule = ruleFromDraft(draft, "rule-1", request);
  assert.equal(httpRule.statusCode, 503);
  assert.equal(httpRule.enabled, false);
  assert.equal(httpRule.blockType, "http-error");

  const networkRule = ruleFromDraft({ ...draft, blockType: "network-fail" }, "rule-1", request);
  assert.equal(networkRule.statusCode, 201);
  assert.equal(networkRule.blockStatus, 503);
  assert.equal(networkRule.blockType, "network-fail");
});

test("diagnostics distinguish a matching rule from a failed method match", () => {
  const translate = (key, params) => `${key}:${params?.count ?? ""}`;
  const rule = { urlPattern: "example\\.com/api/users", method: "POST" };
  const matched = buildRuleDiagnostics(rule, [request], translate);
  assert.equal(matched.open, false);
  assert.equal(matched.summary, "diagnosticsMatched:1");

  const mismatch = buildRuleDiagnostics({ ...rule, method: "GET" }, [request], translate);
  assert.equal(mismatch.open, true);
  assert.equal(mismatch.rows.find((row) => row.label === "method:").ok, false);
});


test("editing rules preserves exact URLs, custom headers and body-preservation mode", () => {
  const original = { id: "legacy", url: "https://example.com/api?exact=1", resHeaders: [{ name: "X-Test", value: "yes" }], enabled: true };
  const draft = initialRuleDraft(original, null);
  const saved = ruleFromDraft(draft, original.id, null);
  assert.equal(saved.url, original.url);
  assert.equal(saved.urlPattern, "");
  assert.equal(saved.resBody, null);
  assert.deepEqual(saved.resHeaders, original.resHeaders);
  assert.throws(() => ruleFromDraft({ ...draft, statusCode: "999" }, original.id, null));
});

test('editing a broad rule does not inherit filters or status from its latest captured request', () => {
  const original = {id:'broad', enabled:true, urlPattern:'.*'};
  const draft = initialRuleDraft(original, {...request, method:'HEAD', resStatus:503, graphql:{operationName:'SpecificOperation'}});
  assert.equal(draft.method, '*');
  assert.equal(draft.operationName, '');
  assert.equal(draft.bodyContains, '');
  assert.equal(draft.statusCode, '');
  const saved = ruleFromDraft(draft, original.id, request);
  assert.equal(saved.statusCode, undefined);
  assert.equal(saved.operationName, undefined);
  assert.equal(saved.bodyContains, undefined);
});
