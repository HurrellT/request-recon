import { LLM_PROVIDERS, validateLlmSettings } from "./llm.js";

export const defaultLlmSettings = () => ({ provider: "ollama", endpoint: LLM_PROVIDERS[0].endpoint, model: "" });

export async function loadLlmSettings(storage) {
  const [{ llmSettings }, { llmCredential }] = await Promise.all([
    storage.local.get("llmSettings"), storage.session.get("llmCredential"),
  ]);
  let settings;
  try { settings = validateLlmSettings(llmSettings); }
  catch (_) { return { settings: defaultLlmSettings(), token: "" }; }
  const token = llmCredential?.endpoint === settings.endpoint && typeof llmCredential.token === "string" ? llmCredential.token : "";
  return { settings, token };
}

export async function saveLlmSettings(storage, input, token) {
  const settings = validateLlmSettings(input);
  // Tokens never go to persistent storage, rule exports, or runtime command messages.
  await storage.session.set({ llmCredential: { endpoint: settings.endpoint, token } });
  await storage.local.set({ llmSettings: settings });
}

export async function forgetLlmSettings(storage) {
  await Promise.all([storage.local.remove("llmSettings"), storage.session.remove("llmCredential")]);
}
