import assert from "node:assert/strict";
import test from "node:test";
import { createRoot, createSignal } from "solid-js";
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
    assert.equal(state.rule().id, "existing");
    state.update("responseBody", "unsaved original");
    state.startGeneratedDraft({ name: "AI users", statusCode: 201, body: '{"users":[]}' });
    assert.equal(state.rule(), null);
    assert.equal(state.draft.responseBody, '{"users":[]}');
    assert.equal(state.draft.statusCode, 201);
    const saved = ruleFromDraft(state.draft, state.rule()?.id, request);
    assert.notEqual(saved.id, oldRule.id);
    assert.notEqual(saved.urlPattern, ".*");
    state.markSaved();
    setDirectRule(saved);
    assert.equal(state.rule().id, saved.id);
    assert.equal(state.draft.responseBody, '{\n  "users": []\n}');
    assert.equal(oldRule.resBody, "old");
    setDirectRule(null);
    assert.equal(state.draft.responseBody, "unsaved original");
  } finally { dispose(); }
});
