import { createEffect, createSignal, For, on, onCleanup, Show } from "solid-js";
import { t } from "../../lib/i18n";
import { fetchLlmModels, LlmError, LLM_PROVIDERS, llmModelsEndpoint, llmPermissionOrigin, validateLlmConnection } from "../../lib/llm";
import { Button, CheckboxField, FormField, Input, Select } from "../../ui/Controls";

export function LlmModelPicker(props) {
  const [models, setModels] = createSignal([]);
  const [manual, setManual] = createSignal(false);
  const [autoFetch, setAutoFetch] = createSignal(true);
  const [loading, setLoading] = createSignal(false);
  const [loaded, setLoaded] = createSignal(false);
  const [error, setError] = createSignal("");
  let operation = 0;
  let controller;
  let disposed = false;

  const cancel = () => {
    operation++;
    controller?.abort();
    controller = null;
    setLoading(false);
  };
  createEffect(on([() => props.settings.provider, () => props.settings.endpoint, () => props.token], () => {
    cancel();
    setModels([]);
    setLoaded(false);
    setError("");
  }));
  createEffect(on(() => props.active, (active) => { if (!active) cancel(); }));
  onCleanup(() => { disposed = true; cancel(); });

  const load = async () => {
    if (props.disabled || !props.active || loading()) return;
    let connection;
    const token = props.token;
    try {
      connection = validateLlmConnection(props.settings);
      llmModelsEndpoint(connection);
      if (LLM_PROVIDERS.find((entry) => entry.id === connection.provider).tokenRequired && !token.trim()) throw new LlmError("llmModelsTokenRequired");
    } catch (error) { setError(t(error instanceof LlmError ? error.code : "llmInvalidSettings")); return; }
    const current = ++operation;
    controller = new AbortController();
    const signal = controller.signal;
    setLoading(true);
    setError("");
    try {
      // Runs directly in the provider-select or refresh-button gesture.
      const allowed = await chrome.permissions.request({ origins: [llmPermissionOrigin(connection)] });
      if (disposed || current !== operation) return;
      if (!allowed) throw new LlmError("llmPermissionDenied");
      const available = await fetchLlmModels({ settings: connection, token, signal });
      if (disposed || current !== operation) return;
      setModels(available);
      setLoaded(true);
    } catch (error) {
      if (!disposed && current === operation) setError(t(error instanceof LlmError ? error.code : "llmConnectionFailed", error.params));
    } finally {
      if (!disposed && current === operation) { setLoading(false); controller = null; }
    }
  };

  const chooseProvider = (id) => {
    props.onProviderChange(id);
    setManual(false);
    if (autoFetch()) void load();
  };

  return (
    <div class="ai-model-picker">
      <div class="form-row">
        <FormField label={t("llmProvider")}>
          {({ id }) => <Select id={id} variant="form" disabled={props.disabled} value={props.settings.provider} onChange={(event) => chooseProvider(event.currentTarget.value)}>
            <For each={LLM_PROVIDERS}>{(provider) => <option value={provider.id}>{provider.id === "custom" ? t("llmCustomProvider") : provider.name}</option>}</For>
          </Select>}
        </FormField>
        <FormField label={t("llmModel")} hint={t("llmModelHint")}>
          {({ id, describedBy }) => <Select id={id} aria-describedby={describedBy} variant="form" disabled={props.disabled || loading()} value={manual() ? "manual" : props.settings.model ? `model:${props.settings.model}` : ""} onChange={(event) => {
            const value = event.currentTarget.value;
            setManual(value === "manual");
            if (value.startsWith("model:")) props.onModelChange(value.slice(6));
          }}>
            <option value="" disabled selected={!manual() && !props.settings.model}>{loading() ? t("llmModelsLoading") : t("llmSelectModel")}</option>
            <Show when={props.settings.model && !models().some((entry) => entry.id === props.settings.model)}>
              <option value={`model:${props.settings.model}`} selected={!manual()}>{props.settings.model}</option>
            </Show>
            <For each={models()}>{(model) => <option value={`model:${model.id}`} selected={!manual() && props.settings.model === model.id}>{model.name === model.id ? model.id : `${model.name} (${model.id})`}</option>}</For>
            <option value="manual" selected={manual()}>{t("llmManualModel")}</option>
          </Select>}
        </FormField>
      </div>
      <Show when={manual()}>
        <FormField label={t("llmManualModel")}>
          {({ id }) => <Input id={id} variant="form" disabled={props.disabled} value={props.settings.model} placeholder={t("llmModelPlaceholder")} onInput={(event) => props.onModelChange(event.currentTarget.value)} />}
        </FormField>
      </Show>
      <CheckboxField label={t("llmAutoFetchModels")} checked={autoFetch()} disabled={props.disabled} onChange={setAutoFetch} />
      <p class="ai-hint">{t("llmModelsPrivacy")}</p>
      <div class="ai-actions">
        <Button variant="secondary" disabled={props.disabled || loading()} onClick={load}>{loaded() ? t("llmRefreshModels") : t("llmFetchModels")}</Button>
        <Show when={loading()}><span role="status">{t("llmModelsLoading")}</span><Button variant="secondary" onClick={cancel}>{t("llmCancel")}</Button></Show>
        <Show when={loaded() && !loading()}><span class="ai-hint" role="status">{models().length ? t("llmModelsLoaded", { count: models().length }) : t("llmModelsEmpty")}</span></Show>
      </div>
      <Show when={error()}><p class="ai-error" role="alert">{error()} {t("llmModelsFallback")}</p></Show>
    </div>
  );
}
