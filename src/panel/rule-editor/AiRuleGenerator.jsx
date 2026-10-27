import { createEffect, createMemo, createSignal, on, onCleanup, onMount, Show } from "solid-js";
import { t } from "../../lib/i18n";
import { truncateText } from "../../lib/limits";
import { buildGenerationMessages, generateMockResponse, LlmError, LLM_PROVIDERS, llmPermissionOrigin, MAX_LLM_CONTEXT_BYTES, validateLlmSettings } from "../../lib/llm";
import { defaultLlmSettings, forgetLlmSettings, loadLlmSettings, saveLlmSettings } from "../../lib/llm-settings";
import { Button, CheckboxField, FormField, Input, TextArea } from "../../ui/Controls";
import { LlmModelPicker } from "./LlmModelPicker";

export function AiRuleGenerator(props) {
  const [settings, setSettings] = createSignal(defaultLlmSettings());
  const [token, setToken] = createSignal("");
  const [sample, setSample] = createSignal("");
  const [prompt, setPrompt] = createSignal("");
  const [consent, setConsent] = createSignal(false);
  const [loading, setLoading] = createSignal(true);
  const [working, setWorking] = createSignal(false);
  const [error, setError] = createSignal("");
  const [result, setResult] = createSignal(null);
  let operation = 0;
  let controller;
  let disposed = false;

  const canGenerate = createMemo(() => props.active && !loading() && !working() && consent() && !!prompt().trim());

  const destination = createMemo(() => {
    try { return new URL(settings().endpoint).origin; } catch (_) { return ""; }
  });

  const cancel = () => {
    operation++;
    controller?.abort();
    controller = null;
    setWorking(false);
  };

  createEffect(on([() => props.request?.id, () => props.targetKey, () => props.active], () => {
    cancel();
    setSample(truncateText(props.request?.resBody ?? "", MAX_LLM_CONTEXT_BYTES));
    setPrompt("");
    setConsent(false);
    setResult(null);
    setError("");
  }));

  onMount(async () => {
    try {
      const saved = await loadLlmSettings(chrome.storage);
      if (disposed) return;
      setSettings(saved.settings);
      setToken(saved.token);
    } catch (_) { if (!disposed) setError(t("llmStorageFailed")); }
    finally { if (!disposed) setLoading(false); }
  });
  onCleanup(() => { disposed = true; cancel(); });

  const updateSettings = (field, value) => {
    if (field === "endpoint") setToken("");
    setSettings((previous) => ({ ...previous, [field]: value }));
    setConsent(false);
    setResult(null);
    setError("");
  };
  const chooseProvider = (id) => {
    const provider = LLM_PROVIDERS.find((entry) => entry.id === id);
    setSettings({ provider: id, endpoint: provider.endpoint, model: "" });
    setToken("");
    setConsent(false);
    setResult(null);
    setError("");
  };

  const forget = async () => {
    setLoading(true);
    try {
      await forgetLlmSettings(chrome.storage);
      if (disposed) return;
      setSettings(defaultLlmSettings());
      setToken("");
      setConsent(false);
      setResult(null);
      setError("");
    } catch (_) { if (!disposed) setError(t("llmStorageFailed")); }
    finally { if (!disposed) setLoading(false); }
  };

  const generate = async () => {
    if (!canGenerate()) return;
    let connection;
    const context = { statusCode: props.request.resStatus ?? 200, responseBody: sample() };
    const instruction = prompt();
    const apiToken = token();
    try {
      connection = validateLlmSettings(settings());
      buildGenerationMessages(instruction, context);
      if (LLM_PROVIDERS.find((provider) => provider.id === connection.provider).tokenRequired && !apiToken.trim()) throw new LlmError("llmTokenRequired");
    } catch (error) { setError(t(error instanceof LlmError ? error.code : "llmInvalidSettings")); return; }

    const current = ++operation;
    controller = new AbortController();
    const signal = controller.signal;
    setWorking(true);
    setResult(null);
    setError("");
    try {
      // Request from the button's user gesture, before any storage or network awaits.
      const allowed = await chrome.permissions.request({ origins: [llmPermissionOrigin(connection)] });
      if (current !== operation || disposed) return;
      if (!allowed) throw new LlmError("llmPermissionDenied");
      try { await saveLlmSettings(chrome.storage, connection, apiToken); }
      catch (_) { throw new LlmError("llmStorageFailed"); }
      if (current !== operation || disposed) return;
      const proposal = await generateMockResponse({ settings: connection, token: apiToken, prompt: instruction, context, signal });
      if (current === operation && !disposed) setResult(proposal);
    } catch (error) {
      if (current === operation && !disposed) setError(t(error instanceof LlmError ? error.code : "llmConnectionFailed", error.params));
    } finally {
      if (current === operation && !disposed) { setWorking(false); controller = null; }
    }
  };

  return (
    <details class="ai-generator">
      <summary>{t("llmTitle")}</summary>
      <div class="ai-generator-content">
        <p class="ai-hint">{t("llmIntro")}</p>
        <fieldset disabled={loading() || working()}>
          <LlmModelPicker settings={settings()} token={token()} disabled={loading() || working()} active={props.active}
            onProviderChange={chooseProvider} onModelChange={(value) => updateSettings("model", value)} />
          <FormField label={t("llmEndpoint")} hint={t("llmEndpointHint")}>
            {({ id, describedBy }) => <Input id={id} aria-describedby={describedBy} variant="form" type="url" spellcheck={false} value={settings().endpoint} onInput={(event) => updateSettings("endpoint", event.currentTarget.value)} />}
          </FormField>
          <FormField label={t("llmToken")} hint={t("llmTokenHint")}>
            {({ id, describedBy }) => <Input id={id} aria-describedby={describedBy} variant="form" type="password" autocomplete="off" spellcheck={false} value={token()} onInput={(event) => { setToken(event.currentTarget.value); setResult(null); }} />}
          </FormField>
          <Show when={settings().provider === "openai"}><p class="ai-hint">{t("llmOpenAiBillingHint")}</p></Show>
          <Show when={settings().provider === "gemini"}><p class="ai-hint">{t("llmGeminiKeyHint")} <a href="https://aistudio.google.com/apikey" target="_blank" rel="noopener noreferrer">Google AI Studio</a></p></Show>
          <FormField label={t("llmSample")} hint={t("llmSampleHint")}>
            {({ id, describedBy }) => <TextArea id={id} aria-describedby={describedBy} class="ai-sample" variant="form" spellcheck={false} value={sample()} onInput={(event) => { setSample(event.currentTarget.value); setConsent(false); setResult(null); }} />}
          </FormField>
          <Show when={(props.request?.resBody?.length ?? 0) > sample().length}>
            <p class="ai-hint">{t("llmSampleLimited")}</p>
          </Show>
          <FormField label={t("llmPrompt")}>
            {({ id }) => <TextArea id={id} class="ai-prompt" variant="form" placeholder={t("llmPromptPlaceholder")} value={prompt()} onInput={(event) => { setPrompt(event.currentTarget.value); setConsent(false); setResult(null); }} />}
          </FormField>
          <p class="ai-disclosure">{t("llmDisclosure", { destination: destination() || t("llmChosenEndpoint"), status: props.request.resStatus ?? 200 })}</p>
          <CheckboxField label={t("llmConsent")} checked={consent()} onChange={setConsent} />
          <div class="ai-actions">
            <Button variant="primary" disabled={!canGenerate()} onClick={generate}>{t("llmGenerate")}</Button>
            <Button variant="secondary" onClick={forget}>{t("llmForget")}</Button>
          </div>
          <Show when={!prompt().trim() || !consent()}><p class="ai-hint">{t("llmGenerateRequirements")}</p></Show>
        </fieldset>
        <Show when={working()}>
          <div class="ai-actions" role="status"><span>{t("llmGenerating")}</span><Button variant="secondary" onClick={cancel}>{t("llmCancel")}</Button></div>
        </Show>
        <Show when={error()}><p class="ai-error" role="alert">{error()}</p></Show>
        <Show when={result()}>{(proposal) => <div class="ai-preview">
          <strong>{t("llmPreview")}</strong>
          <p>{proposal().name} · HTTP {proposal().statusCode}</p>
          <pre tabindex="0" aria-label={t("llmPreview")}>{proposal().body}</pre>
          <p class="ai-hint">{t("llmPreviewHint")}</p>
          <Button variant="primary" onClick={() => props.onApply(proposal())}>{t("llmApply")}</Button>
        </div>}</Show>
      </div>
    </details>
  );
}
