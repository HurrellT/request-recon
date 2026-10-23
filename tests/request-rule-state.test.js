import test from "node:test";
import assert from "node:assert/strict";
import { getResponseOutcome, requestRuleState } from "../src/lib/request-utils.js";

test("keeps intercepted, blocked, and waiting rules distinct as rule settings change", () => {
  const active = { enabled: true, blockRequest: false };
  const blocking = { enabled: true, blockRequest: true };

  assert.equal(requestRuleState({ ruleApplied: true }, null), "intercepted");
  assert.equal(requestRuleState({ ruleApplied: true }, blocking), "blocked");
  assert.equal(requestRuleState({ ruleApplied: true, appliedBlockRequest: true }, null), "blocked");
  assert.equal(requestRuleState({ ruleApplied: true, appliedBlockRequest: false }, blocking), "intercepted");
  assert.equal(requestRuleState({ ruleId: "rule-1" }, active), "intercepted");
  assert.equal(requestRuleState({ ruleApplied: false }, active), "pending");
  assert.equal(requestRuleState({}, active), "pending");
  assert.equal(requestRuleState({}, { ...active, enabled: false }), null);
});

test("uses the applied response outcome while retaining the captured status", () => {
  assert.deepEqual(getResponseOutcome({ resStatus: 200, appliedStatus: 500 }), { status: 500, networkFailure: false });
  assert.deepEqual(getResponseOutcome({ resStatus: 200, networkFailureApplied: true }), { status: null, networkFailure: true });
  assert.deepEqual(getResponseOutcome({ resStatus: 503 }), { status: 503, networkFailure: false });
});
