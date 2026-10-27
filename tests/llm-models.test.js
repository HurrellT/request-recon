import assert from "node:assert/strict";
import test from "node:test";
import { fetchLlmModels, LlmError, LLM_PROVIDERS, llmModelsEndpoint, normalizeLlmModels } from "../src/lib/llm.js";

const connection = (provider = "ollama") => ({ provider, endpoint: LLM_PROVIDERS.find((entry) => entry.id === provider).endpoint });
const code = (expected) => (error) => error instanceof LlmError && error.code === expected;
const json = (data) => new Response(JSON.stringify(data));

test("model discovery uses native Ollama or compatible list endpoints without requiring a model ID", () => {
  assert.equal(llmModelsEndpoint(connection()), "http://localhost:11434/api/tags");
  assert.equal(llmModelsEndpoint(connection("lmstudio")), "http://localhost:1234/v1/models");
  assert.equal(llmModelsEndpoint(connection("openai")), "https://api.openai.com/v1/models");
  assert.equal(llmModelsEndpoint(connection("gemini")), "https://generativelanguage.googleapis.com/v1beta/openai/models");
  assert.equal(llmModelsEndpoint(connection("openrouter")), "https://openrouter.ai/api/v1/models");
  assert.equal(llmModelsEndpoint({ provider: "custom", endpoint: "https://proxy.example/tenant/v1/chat/completions/" }), "https://proxy.example/tenant/v1/models");
  assert.equal(llmModelsEndpoint({ provider: "ollama", endpoint: "https://proxy.example/tenant/api/chat" }), "https://proxy.example/tenant/api/tags");
  assert.throws(() => llmModelsEndpoint({ provider: "custom", endpoint: "https://proxy.example/generate" }), code("llmModelsEndpointUnavailable"));
  assert.throws(() => llmModelsEndpoint({ ...connection(), endpoint: "http://remote.example/api/chat" }), code("llmInvalidEndpoint"));
});

test("model lists normalize IDs and names, remove duplicates and preserve real provider IDs", () => {
  assert.deepEqual(normalizeLlmModels({ models: [{ name: "z:latest" }, { model: "a:7b", name: "A" }, { name: "z:latest" }] }, "ollama"), [
    { id: "a:7b", name: "A" }, { id: "z:latest", name: "z:latest" },
  ]);
  assert.deepEqual(normalizeLlmModels({ data: [{ id: "vendor/model-v2", name: "Model Two" }, { id: "vendor/model-v1" }, { id: "vendor/model-v2", name: "Model Two" }, null, { id: "" }, { id: "bad\nmodel" }, { id: "x".repeat(257) }] }, "openrouter"), [
    { id: "vendor/model-v1", name: "vendor/model-v1" }, { id: "vendor/model-v2", name: "Model Two" },
  ]);
  assert.deepEqual(normalizeLlmModels({ models: [] }, "ollama"), []);
  assert.deepEqual(normalizeLlmModels({ data: [] }, "custom"), []);
  for (const value of [null, {}, { data: "not a list" }, { data: [null, { id: 1 }] }, { data: Array(5001).fill({ id: "a" }) }]) {
    assert.throws(() => normalizeLlmModels(value, "openai"), code("llmModelsInvalidOutput"));
  }
});

test("model discovery is a metadata-only GET and does not transmit captured traffic or prompts", async () => {
  for (const provider of ["ollama", "lmstudio", "openai", "gemini", "openrouter", "custom"]) {
    const settings = provider === "custom" ? { provider, endpoint: "https://custom.example/v1/chat/completions" } : connection(provider);
    let call;
    const models = await fetchLlmModels({ settings: { ...settings, responseBody: "SECRET", prompt: "SECRET", url: "https://private.example" }, token: "fake-token",
      fetchImpl: async (url, init) => { call = { url, ...init }; return json(provider === "ollama" ? { models: [{ name: "local:latest" }] } : { data: [{ id: "test-model" }] }); },
    });
    assert.equal(models.length, 1);
    assert.equal(call.url, llmModelsEndpoint(settings));
    assert.equal(call.method, "GET");
    assert.equal(call.body, undefined);
    assert.equal(call.headers.Authorization, "Bearer fake-token");
    assert.equal(call.credentials, "omit");
    assert.equal(call.redirect, "error");
    assert.equal(call.referrerPolicy, "no-referrer");
    assert.equal(JSON.stringify(call).includes("SECRET"), false);
  }
});

test("local model lists work without a token and cloud discovery validates credentials before fetch", async () => {
  let called = false;
  await fetchLlmModels({ settings: connection(), fetchImpl: async (_url, init) => {
    assert.equal(init.headers.Authorization, undefined);
    return json({ models: [] });
  } });
  for (const provider of ["openai", "gemini", "openrouter"]) {
    await assert.rejects(fetchLlmModels({ settings: connection(provider), fetchImpl: async () => { called = true; } }), code("llmModelsTokenRequired"));
  }
  await assert.rejects(fetchLlmModels({ settings: connection(), token: "bad\ntoken", fetchImpl: async () => { called = true; } }), code("llmInvalidToken"));
  assert.equal(called, false);
});

test("model discovery handles HTTP failures and malformed lists without displaying provider bodies", async () => {
  await assert.rejects(fetchLlmModels({ settings: connection(), fetchImpl: async () => new Response("secret-token private error", { status: 403 }) }), (error) => {
    assert.equal(error.code, "llmProviderError");
    assert.deepEqual(error.params, { status: 403 });
    assert.equal(JSON.stringify(error).includes("secret-token"), false);
    return true;
  });
  for (const response of [new Response("invalid JSON"), json({ message: "not a list" })]) {
    await assert.rejects(fetchLlmModels({ settings: connection(), fetchImpl: async () => response }), code("llmModelsInvalidOutput"));
  }
  await assert.rejects(fetchLlmModels({ settings: connection(), fetchImpl: async () => { throw new Error("secret-token"); } }), code("llmConnectionFailed"));
  let cancelled = false;
  const body = new ReadableStream({
    start(stream) { stream.enqueue(new Uint8Array(8 * 1024 * 1024 + 1)); },
    cancel() { cancelled = true; },
  });
  await assert.rejects(fetchLlmModels({ settings: connection(), fetchImpl: async () => new Response(body) }), code("llmModelsTooLarge"));
  assert.equal(cancelled, true);
});

test("model discovery aborts when cancelled or timed out", async () => {
  const fetchImpl = async (_url, { signal }) => new Promise((_resolve, reject) => {
    if (signal.aborted) { reject(new Error("aborted")); return; }
    signal.addEventListener("abort", () => reject(new Error("aborted")), { once: true });
  });
  const controller = new AbortController();
  const pending = fetchLlmModels({ settings: connection(), signal: controller.signal, fetchImpl });
  controller.abort();
  await assert.rejects(pending, code("llmCancelled"));
  await assert.rejects(fetchLlmModels({ settings: connection(), timeoutMs: 5, fetchImpl }), code("llmModelsTimeout"));
});

test("model discovery shares the actionable 429 quota diagnosis", async () => {
  await assert.rejects(fetchLlmModels({ settings: connection("openai"), token: "fake-token",
    fetchImpl: async () => new Response(JSON.stringify({ error: { code: "insufficient_quota", message: "SECRET" } }), { status: 429 }),
  }), (error) => {
    assert.equal(error.code, "llmQuotaExceeded");
    assert.deepEqual(error.params, { status: 429, providerCode: "insufficient_quota" });
    assert.equal(JSON.stringify(error).includes("SECRET"), false);
    return true;
  });
});
