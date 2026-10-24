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
import {
  applyTrafficVisibility,
  setRules,
  toast,
} from "./store";
import { usePort } from "./usePort";
import { initializeLanguage, language } from "../lib/i18n";

function PanelApp() {
  const tabId = chrome.devtools.inspectedWindow.tabId;
  usePort(tabId);
  const cleanupLanguage = initializeLanguage();
  onCleanup(cleanupLanguage);
  createEffect(() => { document.documentElement.lang = language(); });

  onMount(() => {
    chrome.storage.local.get("trafficVisibility").then(({ trafficVisibility: saved }) => {
      if (saved) applyTrafficVisibility(saved);
    });
  });

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === "local" && changes.rules) {
      setRules(changes.rules.newValue || []);
    }
    if (area === "local" && changes.trafficVisibility) {
      applyTrafficVisibility(changes.trafficVisibility.newValue);
    }
  });

  return (
    <div id="app">
      <PanelToolbar />

      <div id="main">
        <RequestList />
        <RequestDetail renderRuleEditor={(req, directRule) => <RuleEditor req={req} directRule={directRule} />} />
        <RulesSidebar />
      </div>

      <div id="toast" classList={{ show: !!toast(), success: toast()?.type === "success", error: toast()?.type === "error" }}>
        {toast()?.message}
      </div>
    </div>
  );
}

document.getElementById("setup-hint")?.remove();
render(() => <PanelApp />, document.getElementById("root"));
