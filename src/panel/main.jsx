import { render } from "solid-js/web";
import { createEffect, onCleanup, onMount } from "solid-js";
import "../styles.css";
import "../ui/ui.css";
import "./panel.css";
import "./toolbar/toolbar.css";
import "./request-list/request-list.css";
import "./detail/detail.css";
import "./rule-editor/rule-editor.css";
import "./rules-sidebar/rules-sidebar.css";
import { PanelToolbar } from "./toolbar/PanelToolbar";
import { RequestList } from "./request-list/RequestList";
import { RequestDetail } from "./detail/RequestDetail";
import { RuleEditor } from "./rule-editor/RuleEditor";
import { RulesSidebar } from "./rules-sidebar/RulesSidebar";
import { Toast } from "../ui/Toast";
import { DonationLink } from "../ui/DonationLink";
import {
  applyTrafficVisibility,
  setRules,
  toast,
  showToast,
  send,
} from "./store";
import { usePort } from "./usePort";
import { initializeLanguage, language, t } from "../lib/i18n";
import { validateRules } from "../lib/rules";

function PanelApp() {
  const tabId = chrome.devtools.inspectedWindow.tabId;
  usePort(tabId);
  const cleanupLanguage = initializeLanguage();
  onCleanup(cleanupLanguage);
  createEffect(() => { document.documentElement.lang = language(); });

  onMount(() => {
    chrome.storage.local.get("trafficVisibility").then(({ trafficVisibility: saved }) => {
      if (saved) applyTrafficVisibility(saved);
    }).catch(() => showToast(t("preferencesSaveFailed"), "error"));
  });

  const onStorageChanged = (changes, area) => {
    if (area === "local" && changes.rules) {
      try { setRules(validateRules(changes.rules.newValue || [])); }
      catch (_) { send({ type: "GET_RULES" }).catch(() => {}); }
    }
    if (area === "local" && changes.trafficVisibility) {
      applyTrafficVisibility(changes.trafficVisibility.newValue);
    }
  };
  chrome.storage.onChanged.addListener(onStorageChanged);
  onCleanup(() => chrome.storage.onChanged.removeListener(onStorageChanged));

  return (
    <div id="app">
      <PanelToolbar />

      <div id="main">
        <RequestList />
        <RequestDetail renderRuleEditor={(req, directRule, active) => <RuleEditor req={req} directRule={directRule} active={active} />} />
        <RulesSidebar />
      </div>

      <footer class="panel-support">
        <DonationLink />
      </footer>

      <Toast toast={toast()} />
    </div>
  );
}

document.getElementById("setup-hint")?.remove();
render(() => <PanelApp />, document.getElementById("root"));
