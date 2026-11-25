import assert from "node:assert/strict";
import test from "node:test";
import { createRoot, createSignal, flush } from "solid-js";
import { useRuleDraft } from "../src/panel/rule-editor/useRuleDraft.js";
import { ruleFromDraft } from "../src/panel/rule-editor/draft.js";

test("using an AI proposal creates a separate reactive draft and save targets its new ID", () => {
  let state, dispose;
  const request = { id: "selected", url: "https://example.com/users", method: "GET", resBody: "{}", resStatus: 200 };
  const [directRule, setDirectRule] = createSignal(null);
  const oldRule = { id: "existing", name: "Existing", urlPattern: ".*", resBody: "old", enabled: true };
  createRoot((cleanup) => {
    dispose = cleanup;
    state = useRuleDraft({ req: request, get directRule() { return directRule(); } }, () => directRule() || oldRule);
  });
  try {
    flush();
    assert.equal(state.rule().id, "existing");
    state.update("responseBody", "unsaved original");
    flush();
    state.startGeneratedDraft({ name: "AI users", statusCode: 201, body: '{"users":[]}' });
    flush();
    assert.equal(state.rule(), null);
    assert.equal(state.draft.responseBody, '{"users":[]}');
    assert.equal(state.draft.statusCode, 201);
    const saved = ruleFromDraft(state.draft, state.rule()?.id, request);
    assert.notEqual(saved.id, oldRule.id);
    assert.notEqual(saved.urlPattern, ".*");
    state.markSaved();
    setDirectRule(saved);
    flush();
    assert.equal(state.rule().id, saved.id);
    assert.equal(state.draft.responseBody, '{\n  "users": []\n}');
    assert.equal(oldRule.resBody, "old");
    setDirectRule(null);
    flush();
    assert.equal(state.draft.responseBody, "unsaved original");
  } finally { dispose(); }
});

test("switching requests restores the unsaved draft for each selection", () => {
  const first = { id: "first", url: "https://example.com/first" };
  const second = { id: "second", url: "https://example.com/second" };
  const [request, setRequest] = createSignal(first);
  let dispose;
  const state = createRoot((cleanup) => {
    dispose = cleanup;
    return useRuleDraft({ get req() { return request(); } }, () => null);
  });
  try {
    flush();
    state.update("name", "Unsaved first rule");
    setRequest(second);
    flush();
    assert.equal(state.draft.name, "/second");

    state.update("name", "Unsaved second rule");
    setRequest(first);
    flush();
    assert.equal(state.draft.name, "Unsaved first rule");

    setRequest(second);
    flush();
    assert.equal(state.draft.name, "Unsaved second rule");
  } finally { dispose(); }
});
