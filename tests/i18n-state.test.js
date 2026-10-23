import assert from "node:assert/strict";
import test from "node:test";

test("a saved language syncs across views without overriding a newer choice", async () => {
  let resolveInitialRead;
  const listeners = new Set();
  globalThis.chrome = {
    i18n: { getUILanguage: () => "es-AR" },
    storage: {
      local: {
        get: () => new Promise((resolve) => { resolveInitialRead = resolve; }),
        set: async ({ language }) => {
          for (const listener of listeners) listener({ language: { newValue: language } }, "local");
        },
      },
      onChanged: {
        addListener: (listener) => listeners.add(listener),
        removeListener: (listener) => listeners.delete(listener),
      },
    },
  };

  try {
    const { language, chooseLanguage, initializeLanguage } = await import("../src/lib/i18n.js");
    const cleanup = initializeLanguage();
    assert.equal(language(), "es");

    await chooseLanguage("en");
    resolveInitialRead({ language: "es" });
    await Promise.resolve();
    assert.equal(language(), "en");

    for (const listener of listeners) listener({ language: { newValue: "es" } }, "local");
    assert.equal(language(), "es");

    cleanup();
    assert.equal(listeners.size, 0);
  } finally {
    delete globalThis.chrome;
  }
});
