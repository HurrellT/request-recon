import assert from "node:assert/strict";
import test from "node:test";
import { buildGenerationMessages, generateMockResponse, LlmError, LLM_PROVIDERS, llmPermissionOrigin, MAX_LLM_CONTEXT_BYTES, parseGeneratedResponse, validateLlmSettings } from "../src/lib/llm.js";
import { forgetLlmSettings, loadLlmSettings, saveLlmSettings } from "../src/lib/llm-settings.js";
import { draftFromGeneration, ruleFromDraft } from "../src/panel/rule-editor/draft.js";
import { exportRules } from "../src/lib/rules.js";

const settings = (provider = "ollama") => ({ provider, endpoint: LLM_PROVIDERS.find((entry) => entry.id === provider).endpoint, model: "test-model" });
const generated = { name: "Empty users", statusCode: 200, body: '{"users":[]}' };
const context = { statusCode: 200, responseBody: '{"users":[{"name":"Example"}]}' };
const code = (expected) => (error) => error instanceof LlmError && error.code === expected;
const payload = (data) => new Response(JSON.stringify(data), { headers: { "Content-Type": "application/json" } });

test("connection settings allow HTTPS and loopback HTTP and reject credential-bearing endpoints", () => {
  for (const endpoint of ["https://provider.example/v1/chat/completions", "http://localhost:11434/api/chat", "http://127.0.0.1:1234/v1/chat/completions", "http://[::1]:11434/api/chat"]) {
    assert.equal(validateLlmSettings({ ...settings(), endpoint }).endpoint, endpoint);
  }
  for (const endpoint of ["http://provider.example/chat", "http://192.168.1.2/chat", "file:///tmp/model", "javascript:alert(1)", "https://user:secret@provider.example/chat", "https://provider.example/chat?key=secret", "https://provider.example/chat#secret", "http://localhost.evil.example/chat"]) {
    assert.throws(() => validateLlmSettings({ ...settings(), endpoint }), code("llmInvalidEndpoint"));
  }
  assert.throws(() => validateLlmSettings({ ...settings(), model: " " }), code("llmInvalidSettings"));
  assert.throws(() => validateLlmSettings({ ...settings(), provider: "unknown" }), code("llmInvalidSettings"));
  assert.equal(llmPermissionOrigin(settings()), "http://localhost/*");
  assert.equal(llmPermissionOrigin(settings("openai")), "https://api.openai.com/*");
});

test("generation context excludes URLs, headers, request bodies and GraphQL variables", () => {
  const messages = buildGenerationMessages("Create an empty list", {
    ...context, url: "https://private.example/?token=SECRET", reqHeaders: [{ name: "Authorization", value: "SECRET" }], reqBody: "SECRET", graphql: { variables: "SECRET" },
  });
  assert.equal(JSON.stringify(messages).includes("SECRET"), false);
  assert.deepEqual(JSON.parse(messages[1].content).responseSample, context);
  assert.throws(() => buildGenerationMessages(" ", context), code("llmInvalidPrompt"));
  assert.throws(() => buildGenerationMessages("x".repeat(8193), context), code("llmInvalidPrompt"));
  assert.throws(() => buildGenerationMessages("Generate", { ...context, responseBody: "é".repeat(MAX_LLM_CONTEXT_BYTES / 2 + 1) }), code("llmContextTooLarge"));
});

test("Ollama receives a non-streaming JSON request and no token unless provided", async () => {
  let call;
  const result = await generateMockResponse({ settings: settings(), prompt: "Create an empty list", context,
    fetchImpl: async (url, init) => { call = { url, ...init }; return payload({ done: true, done_reason: "stop", message: { content: JSON.stringify(generated) } }); },
  });
  assert.deepEqual(result, generated);
  assert.equal(call.url, settings().endpoint);
  assert.equal(call.headers.Authorization, undefined);
  assert.equal(call.credentials, "omit");
  assert.equal(call.redirect, "error");
  assert.equal(call.referrerPolicy, "no-referrer");
  const body = JSON.parse(call.body);
  assert.equal(body.format, "json");
  assert.equal(body.stream, false);
  assert.equal(body.model, "test-model");
});

test("OpenAI-compatible providers use a bearer token and chat completions payload", async () => {
  for (const provider of ["openai", "openrouter", "lmstudio", "custom"]) {
    const connection = provider === "custom" ? { ...settings(provider), endpoint: "https://custom.example/v1/chat/completions" } : settings(provider);
    let call;
    const result = await generateMockResponse({ settings: connection, token: "test-token", prompt: "Mock users", context,
      fetchImpl: async (url, init) => { call = { url, ...init }; return payload({ choices: [{ finish_reason: "stop", message: { content: JSON.stringify(generated) } }] }); },
    });
    assert.deepEqual(result, generated);
    assert.equal(call.url, connection.endpoint);
    assert.equal(call.headers.Authorization, "Bearer test-token");
    assert.deepEqual(JSON.parse(call.body).response_format, { type: "json_object" });
  }
});

test("missing cloud tokens and invalid instructions fail before network access", async () => {
  let called = false;
  const fetchImpl = async () => { called = true; };
  await assert.rejects(generateMockResponse({ settings: settings("openai"), prompt: "Mock", context, fetchImpl }), code("llmTokenRequired"));
  await assert.rejects(generateMockResponse({ settings: settings(), token: "bad\ntoken", prompt: "Mock", context, fetchImpl }), code("llmInvalidToken"));
  await assert.rejects(generateMockResponse({ settings: settings(), prompt: "", context, fetchImpl }), code("llmInvalidPrompt"));
  assert.equal(called, false);
});

test("provider errors never expose a response body that might echo credentials or traffic", async () => {
  let error;
  try {
    await generateMockResponse({ settings: settings(), token: "SECRET", prompt: "Mock", context,
      fetchImpl: async () => new Response('SECRET: private traffic', { status: 401 }),
    });
  } catch (value) { error = value; }
  assert.equal(error.code, "llmProviderError");
  assert.deepEqual(error.params, { status: 401 });
  assert.equal(JSON.stringify(error).includes("SECRET"), false);
  await assert.rejects(generateMockResponse({ settings: settings(), prompt: "Mock", context, fetchImpl: async () => { throw new Error("SECRET"); } }), code("llmConnectionFailed"));
});

test("429 distinguishes exhausted API quota, rate limits and unknown causes without exposing provider text", async () => {
  const cases = [
    { error: { code: "insufficient_quota" }, expected: "llmQuotaExceeded" },
    { error: { code: "credit_balance_exhausted", type: "insufficient_quota" }, expected: "llmQuotaExceeded" },
    { error: { code: "project_spend_limit_exceeded" }, expected: "llmQuotaExceeded" },
    { error: { code: "organization_spend_limit_exceeded" }, expected: "llmQuotaExceeded" },
    { error: { code: "organization_usage_limit_exceeded" }, expected: "llmQuotaExceeded" },
    { error: { type: "insufficient_quota" }, expected: "llmQuotaExceeded" },
    { error: { code: "rate_limit_exceeded" }, expected: "llmRateLimited" },
    { error: { code: "slow_down", type: "rate_limit_error" }, expected: "llmRateLimited" },
    { error: { code: "rate_limit_exceeded", type: "insufficient_quota" }, expected: "llmRateLimited" },
    { error: { type: "rate_limit_error" }, expected: "llmRateLimited" },
    { error: { code: "SECRET" }, expected: "llmRateOrQuota" },
  ];
  for (const { error, expected } of cases) {
    await assert.rejects(generateMockResponse({ settings: settings("openai"), token: "SECRET", prompt: "Mock", context,
      fetchImpl: async () => new Response(JSON.stringify({ error: { ...error, message: "SECRET private response sample" } }), { status: 429, headers: { "Retry-After": "12" } }),
    }), (failure) => {
      assert.equal(failure.code, expected);
      assert.equal(failure.params.status, 429);
      assert.equal(JSON.stringify(failure).includes("SECRET"), false);
      if (expected === "llmQuotaExceeded") assert.equal(failure.params.providerCode, error.code ?? "insufficient_quota (type)");
      if (expected === "llmRateLimited") assert.equal(failure.params.seconds, 12);
      return true;
    });
  }
});

test("Gemini uses Google's compatible chat endpoint, bearer key and structured response schema", async () => {
  let call;
  const result = await generateMockResponse({ settings: settings("gemini"), token: "google-test-key", prompt: "Mock users", context,
    fetchImpl: async (url, init) => { call = { url, ...init }; return payload({ choices: [{ finish_reason: "stop", message: { content: JSON.stringify(generated) } }] }); },
  });
  assert.equal(call.url, "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions");
  assert.equal(call.headers.Authorization, "Bearer google-test-key");
  assert.equal(call.url.includes("key="), false);
  const body = JSON.parse(call.body);
  assert.equal(body.stream, false);
  assert.equal(body.response_format.type, "json_schema");
  assert.equal(body.response_format.json_schema.strict, true);
  assert.deepEqual(body.response_format.json_schema.schema.required, ["name", "statusCode", "body"]);
  assert.deepEqual(result, generated);
  await assert.rejects(generateMockResponse({ settings: settings("gemini"), prompt: "Mock", context, fetchImpl: async () => assert.fail("missing Gemini key must not fetch") }), code("llmTokenRequired"));
});

test("429 without structured details keeps its HTTP diagnosis and bounds error-body reads", async () => {
  for (const content of ["not JSON SECRET", JSON.stringify({ message: "SECRET" }), JSON.stringify({ error: { message: "SECRET", padding: "x".repeat(65536) } })]) {
    await assert.rejects(generateMockResponse({ settings: settings(), prompt: "Mock", context,
      fetchImpl: async () => new Response(content, { status: 429 }),
    }), (failure) => {
      assert.equal(failure.code, "llmRateOrQuota");
      assert.deepEqual(failure.params, { status: 429 });
      assert.equal(JSON.stringify(failure).includes("SECRET"), false);
      return true;
    });
  }
  await assert.rejects(generateMockResponse({ settings: settings(), prompt: "Mock", context,
    fetchImpl: async () => new Response(JSON.stringify({ error: { type: "rate_limit_error" } }), { status: 429, headers: { "Retry-After": "SECRET" } }),
  }), (failure) => {
    assert.equal(failure.code, "llmRateLimited");
    assert.equal(failure.params.seconds, 0);
    assert.equal(JSON.stringify(failure).includes("SECRET"), false);
    return true;
  });
});

test("malformed, truncated and oversized provider responses are rejected", async () => {
  const inputs = [
    new Response("not JSON"),
    payload({ message: { content: "not JSON" } }),
    payload({ done: false, message: { content: JSON.stringify(generated) } }),
    payload({ done_reason: "length", message: { content: JSON.stringify(generated) } }),
  ];
  for (const response of inputs) await assert.rejects(generateMockResponse({ settings: settings(), prompt: "Mock", context, fetchImpl: async () => response }), code("llmInvalidOutput"));
  await assert.rejects(generateMockResponse({ settings: settings("lmstudio"), prompt: "Mock", context,
    fetchImpl: async () => payload({ choices: [{ finish_reason: "length", message: { content: JSON.stringify(generated) } }] }),
  }), code("llmInvalidOutput"));
  let cancelled = false;
  const body = new ReadableStream({
    start(stream) { stream.enqueue(new Uint8Array(2 * 1024 * 1024 + 1)); },
    cancel() { cancelled = true; },
  });
  await assert.rejects(generateMockResponse({ settings: settings(), prompt: "Mock", context, fetchImpl: async () => new Response(body) }), code("llmOutputTooLarge"));
  assert.equal(cancelled, true);
});

test("cancellation and timeout abort the provider request", async () => {
  const fetchImpl = async (_url, { signal }) => new Promise((_resolve, reject) => {
    if (signal.aborted) { reject(new Error("aborted")); return; }
    signal.addEventListener("abort", () => reject(new Error("aborted")), { once: true });
  });
  const controller = new AbortController();
  const pending = generateMockResponse({ settings: settings(), prompt: "Mock", context, signal: controller.signal, fetchImpl });
  controller.abort();
  await assert.rejects(pending, code("llmCancelled"));
  await assert.rejects(generateMockResponse({ settings: settings(), prompt: "Mock", context, timeoutMs: 5, fetchImpl }), code("llmTimeout"));
});

test("generated output is validated as data and cannot change URL scope or run code", () => {
  assert.deepEqual(parseGeneratedResponse(`\`\`\`json\n${JSON.stringify(generated)}\n\`\`\``), generated);
  assert.deepEqual(parseGeneratedResponse(JSON.stringify({ ...generated, urlPattern: ".*", enabled: true, apiKey: "SECRET" })), generated);
  for (const value of [null, [], { ...generated, statusCode: 999 }, { ...generated, name: "" }, { ...generated, body: {} }, { ...generated, body: "x".repeat(1024 * 1024 + 1) }, { ...generated, statusCode: 204 }]) {
    assert.throws(() => parseGeneratedResponse(JSON.stringify(value)), code("llmInvalidOutput"));
  }
  assert.throws(() => parseGeneratedResponse('(() => fetch("https://evil.example"))()'), code("llmInvalidOutput"));
});

test("AI drafts use the selected request scope and stay separate from an existing rule", () => {
  const request = { id: "captured", url: "https://example.com/api/users?secret=local", method: "POST", graphql: { operationName: "GetUsers" }, resBody: "{}", resStatus: 200, ruleId: "existing" };
  const draft = draftFromGeneration(request, { ...generated, urlPattern: ".*", id: "existing", enabled: true });
  const rule = ruleFromDraft(draft, null, request);
  assert.notEqual(rule.id, request.ruleId);
  assert.equal(rule.method, "POST");
  assert.equal(rule.operationName, "GetUsers");
  assert.equal(rule.resBody, generated.body);
  assert.equal(rule.blockRequest, false);
  assert.equal(rule.urlPattern.includes("secret"), false);
  assert.equal(new RegExp(rule.urlPattern).test("https://unrelated.example/api/users"), false);
  assert.equal(new RegExp(rule.urlPattern).test(request.url), true);
  assert.equal(exportRules([rule]).includes("apiKey"), false);
});

function storageFixture() {
  const data = { local: {}, session: {} };
  const storage = Object.fromEntries(Object.keys(data).map((area) => [area, {
    get: async (key) => ({ [key]: data[area][key] }),
    set: async (values) => Object.assign(data[area], structuredClone(values)),
    remove: async (key) => { delete data[area][key]; },
  }]));
  return { data, storage };
}

test("only connection preferences persist; tokens are session-only and endpoint-scoped", async () => {
  const { data, storage } = storageFixture();
  const connection = settings("openai");
  await saveLlmSettings(storage, { ...connection, apiKey: "DO-NOT-PERSIST", prompt: "private" }, "SESSION-SECRET");
  assert.deepEqual(data.local.llmSettings, connection);
  assert.equal(JSON.stringify(data.local).includes("SECRET"), false);
  assert.deepEqual(await loadLlmSettings(storage), { settings: connection, token: "SESSION-SECRET" });
  data.local.llmSettings.endpoint = "https://other.example/v1/chat/completions";
  assert.equal((await loadLlmSettings(storage)).token, "");
  await forgetLlmSettings(storage);
  assert.deepEqual(data, { local: {}, session: {} });
  assert.equal((await loadLlmSettings(storage)).settings.provider, "ollama");
});
