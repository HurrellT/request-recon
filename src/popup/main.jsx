import { render } from "solid-js/web";
import { createEffect, createMemo, createSignal, For, onCleanup, onMount, Show } from "solid-js";
import "../styles.css";
import "../ui/ui.css";
import "./popup.css";
import { shortPattern } from "../lib/request-utils";
import { chooseLanguage, initializeLanguage, language, t } from "../lib/i18n";
import { MethodBadge } from "../ui/Badges";
import { EmptyState } from "../ui/EmptyState";
import { Button, FieldLabel, Select, ToggleSwitch } from "../ui/Controls";

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

  const cleanupLanguage = initializeLanguage();
  onCleanup(cleanupLanguage);
  createEffect(() => { document.documentElement.lang = language(); });

  onCleanup(() => {
    chrome.storage.onChanged.removeListener(onStorageChanged);
  });

  return (
    <div class="popup-shell">
      <header class="popup-header">
        <div class="logo">RR</div>
        <span class="header-title">Request Recon</span>
        <Show when={activeCount() > 0}>
          <span class="active-badge">{t("activeRules", { count: activeCount() })}</span>
        </Show>
      </header>

      <div id="rules-section">
        <div class="section-label">{t("rules")}</div>
        <div id="popup-rules-list">
          <Show
            when={rules().length > 0}
            fallback={
              <EmptyState title={t("noRules")}>{t("noRulesPopup")}</EmptyState>
            }
          >
            <For each={rules()}>
              {(rule) => (
                <div class="rule-row" classList={{ disabled: !rule.enabled }}>
                  <ToggleSwitch
                    label={`${rule.enabled ? t("disable") : t("enable")}: ${rule.name || rule.urlPattern || t("unnamed")}`}
                    checked={!!rule.enabled}
                    onChange={(checked) => toggleRule(rule.id, checked)}
                  />
                  <div class="rule-info">
                    <div class="rule-name" title={rule.name || rule.urlPattern || ""}>
                      {rule.name || rule.urlPattern || t("unnamed")}
                    </div>
                    <div class="rule-meta">
                      <Show when={rule.method && rule.method !== "*"}>
                        <MethodBadge method={rule.method} />
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
        <span class="footer-hint">{t("popupFooter")}</span>
        <Show when={rules().length > 0}>
          <Button class="btn-all" onClick={toggleAll}>{anyActive() ? t("disableAll") : t("enableAll")}</Button>
        </Show>
      </footer>
      <div class="popup-language">
        <FieldLabel for="popup-language">{t("language")}</FieldLabel>
        <Select id="popup-language" value={language()} onChange={(event) => chooseLanguage(event.currentTarget.value)}>
          <option value="es">Español</option>
          <option value="en">English</option>
        </Select>
      </div>
    </div>
  );
}

render(() => <PopupApp />, document.getElementById("root"));
