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
  const [busy, setBusy] = createSignal(false);
  const [sessions, setSessions] = createSignal([]);
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
      const reply = await chrome.runtime.sendMessage({ type: "GET_RULES" });
      if (!reply?.ok) throw new Error("Could not load rules");
      setRules(reply.rules || []);
      setSessions(reply.activeSessions || []);
    } catch (_) {
      showSaveError();
    }
  };

  const mutate = async (message) => {
    if (busy()) return;
    setBusy(true);
    try {
      const reply = await chrome.runtime.sendMessage(message);
      if (!reply?.ok) throw new Error("Could not save rules");
      if (reply.rules) setRules(reply.rules);
      if (reply.activeSessions) setSessions(reply.activeSessions);
    } catch (_) {
      showSaveError();
    } finally { setBusy(false); }
  };

  const toggleRule = async (ruleId, enabled) => {
    await mutate({ type: "TOGGLE_RULE", ruleId, enabled });
  };

  const toggleAll = async () => {
    const enabled = !anyActive();
    await mutate({ type: "TOGGLE_ALL", enabled });
  };

  const onStorageChanged = (changes, area) => {
    if (area === "local" && changes.rules) {
      loadRules();
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
      <PopupRuleList rules={rules()} onToggle={toggleRule} busy={busy()} />
      <PopupFooter hasRules={rules().length > 0} anyActive={anyActive()} onToggleAll={toggleAll} busy={busy()} sessionCount={sessions().length} onStopCapture={() => mutate({ type: "STOP_ALL" })} />
      <Toast toast={notice()} />
    </div>
  );
}

render(() => <PopupApp />, document.getElementById("root"));
