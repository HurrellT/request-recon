import test from "node:test";
import assert from "node:assert/strict";
import { validateRule } from "../src/lib/rules.js";
import { parseRulesFile } from "../src/panel/rules-sidebar/import-rules.js";

test("imports a single saved rule, a list, or an empty export", () => {
  const rule = { id: "one", urlPattern: "example.com", statusCode: 500 };
  assert.deepEqual(parseRulesFile(JSON.stringify(rule)), [validateRule(rule)]);
  assert.deepEqual(parseRulesFile(JSON.stringify([rule, { id: "two", urlPattern: "api.example.com" }])), [validateRule(rule), validateRule({ id: "two", urlPattern: "api.example.com" })]);
  assert.deepEqual(parseRulesFile("[]"), []);
});

test("rejects malformed rule files before they reach the service worker", () => {
  for (const contents of ["not json", "null", "42", "{}", '[{"id":"one"},null]', '[[{"id":"one"}]]']) {
    assert.throws(() => parseRulesFile(contents));
  }
});
