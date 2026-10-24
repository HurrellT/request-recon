import { render } from "solid-js/web";
import { createEffect, createMemo, createSignal, onCleanup, onMount } from "solid-js";
import "../styles.css";
import "../ui/ui.css";
import "./popup.css";
import { initializeLanguage, language, t } from "../lib/i18n";
import { Toast } from "../ui/Toast";
import { PopupFooter } from "./PopupFooter";
import { PopupHeader } from "./PopupHeader";
import { PopupRuleList } from "./PopupRuleList";

function PopupApp() {
  const [rules, setRules] = createSignal([]);
  const [notice, setNotice] = createSignal(null);
  let noticeTimer;
  const activeCount = createMemo(() => rules().filter((rule) => rule.enabled).length);
  const anyActive = createMemo(() => rules().some((rule) => rule.enabled));

  const showSaveError = () => {
    setNotice({ message: t("rulesSaveFailed"), type: "error" });
    clearTimeout(noticeTimer);
    noticeTimer = setTimeout(() => setNotice(null), 3000);
  };

  const loadRules = async () => {
    try {
      const { rules: stored = [] } = await chrome.storage.local.get("rules");
      setRules(stored);
    } catch (_) {
      showSaveError();
    }
  };

  const saveRules = async (updated) => {
    try {
      await chrome.storage.local.set({ rules: updated });
      setRules(updated);
    } catch (_) {
      showSaveError();
    }
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
    clearTimeout(noticeTimer);
  });

  return (
    <div class="popup-shell">
      <PopupHeader activeCount={activeCount()} />
      <PopupRuleList rules={rules()} onToggle={toggleRule} />
      <PopupFooter hasRules={rules().length > 0} anyActive={anyActive()} onToggleAll={toggleAll} />
      <Toast toast={notice()} />
    </div>
  );
}

render(() => <PopupApp />, document.getElementById("root"));
