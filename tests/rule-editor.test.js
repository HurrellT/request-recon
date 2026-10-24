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
  assert.equal(fromRequest.responseBody, '{\n  "ok": true\n}');

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
