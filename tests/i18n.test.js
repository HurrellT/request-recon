import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import test from "node:test";
import { messages, normalizeLanguage, translate } from "../src/lib/translations.js";

test("English and Spanish cover every UI translation key", () => {
  assert.deepEqual(Object.keys(messages.en).sort(), Object.keys(messages.es).sort());

  const files = readdirSync(new URL("../src/", import.meta.url), { recursive: true }).filter((file) => /\.(jsx?|tsx?)$/.test(file)).map((file) => `../src/${file}`);
  for (const file of files) {
    const source = readFileSync(new URL(file, import.meta.url), "utf8");
    for (const [, key] of source.matchAll(/\bt\("([^"]+)"/g)) {
      assert.ok(Object.hasOwn(messages.en, key), `${file} uses missing key ${key}`);
    }
  }
});

test("browser language normalization and variable messages", () => {
  assert.equal(normalizeLanguage("es-AR"), "es");
  assert.equal(normalizeLanguage("en-US"), "en");
  assert.equal(normalizeLanguage("fr"), "en");
  assert.equal(translate("en", "hiddenRequests", { count: 1 }), "1 hidden request");
  assert.equal(translate("en", "hiddenRequests", { count: 2 }), "2 hidden requests");
  assert.equal(translate("es", "importedRules", { count: 1 }), "1 regla importada (deshabilitada)");
  assert.equal(translate("es", "importedRules", { count: 2 }), "2 reglas importadas (deshabilitadas)");
});


test("dynamic detail tabs and body-availability messages exist in both languages", () => {
  for (const key of ["requestTab", "responseTab", "ruleTab", ...["overridden", "large", "binary", "stream", "failed", "unavailable"].map((value) => `bodyUnavailable_${value}`)]) {
    assert.ok(messages.en[key]); assert.ok(messages.es[key]);
  }
});
