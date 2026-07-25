import { render } from "solid-js/web";
import { createMemo, createSignal, For, onCleanup, onMount, Show } from "solid-js";
import "../styles.css";
import "./popup.css";
import { methodCSSClass, shortPattern } from "../lib/request-utils";

function PopupApp() {
  const [rules, setRules] = createSignal([]);
  const activeCount = createMemo(() => rules().filter((rule) => rule.enabled).length);
  const anyActive = createMemo(() => rules().some((rule) => rule.enabled));

  const loadRules = async () => {
    const { rules: stored = [] } = await chrome.storage.local.get("rules");
    setRules(stored);
  };

  const saveRules = async (updated) => {
    await chrome.storage.local.set({ rules: updated });
    setRules(updated);
  };

  const toggleRule = async (ruleId, enabled) => {
    const updated = rules().map((rule) => (rule.id === ruleId ? { ...rule, enabled, updatedAt: new Date().toISOString() } : rule));
    await saveRules(updated);
  };

  const toggleAll = async () => {
    const enabled = !anyActive();
    const updated = rules().map((rule) => ({ ...rule, enabled, updatedAt: new Date().toISOString() }));
    await saveRules(updated);
  };

  const onStorageChanged = (changes, area) => {
    if (area === "local" && changes.rules) {
      setRules(changes.rules.newValue || []);
    }
  };

  onMount(() => {
    loadRules();
    chrome.storage.onChanged.addListener(onStorageChanged);
  });

  onCleanup(() => {
    chrome.storage.onChanged.removeListener(onStorageChanged);
  });

  return (
    <div class="popup-shell">
      <header class="popup-header">
        <div class="logo">RR</div>
        <span class="header-title">Request Recon</span>
        <Show when={activeCount() > 0}>
          <span class="active-badge">{activeCount()} activa{activeCount() !== 1 ? "s" : ""}</span>
        </Show>
      </header>

      <div id="rules-section">
        <div class="section-label">Reglas</div>
        <div id="popup-rules-list">
          <Show
            when={rules().length > 0}
            fallback={
              <div class="empty-state">
                <div>Sin reglas configuradas</div>
                <p>Abrí DevTools → pestaña Request Recon para crear reglas</p>
              </div>
            }
          >
            <For each={rules()}>
              {(rule) => (
                <div class="rule-row" classList={{ disabled: !rule.enabled }}>
                  <label class="toggle-switch" title={rule.enabled ? "Deshabilitar" : "Habilitar"}>
                    <input type="checkbox" checked={!!rule.enabled} onChange={(event) => toggleRule(rule.id, event.currentTarget.checked)} />
                    <span class="toggle-slider" />
                  </label>
                  <div class="rule-info">
                    <div class="rule-name" title={rule.name || rule.urlPattern || ""}>
                      {rule.name || rule.urlPattern || "(sin nombre)"}
                    </div>
                    <div class="rule-meta">
                      <Show when={rule.method && rule.method !== "*"}>
                        <span class={`method-badge ${methodCSSClass(rule.method)}`}>{rule.method}</span>
                      </Show>
                      <Show when={rule.operationName} fallback={<span class="rule-url" title={rule.urlPattern}>{shortPattern(rule.urlPattern)}</span>}>
                        <span class="gql-op" title={rule.operationName}>{rule.operationName}</span>
                      </Show>
                    </div>
                  </div>
                </div>
              )}
            </For>
          </Show>
        </div>
      </div>

      <footer class="popup-footer">
        <span class="footer-hint">F12 → Request Recon para editar</span>
        <Show when={rules().length > 0}>
          <button class="btn-all" onClick={toggleAll}>{anyActive() ? "Deshabilitar todo" : "Habilitar todo"}</button>
        </Show>
      </footer>
    </div>
  );
}

render(() => <PopupApp />, document.getElementById("root"));
