import { render } from "solid-js/web";
import { createEffect, For, onCleanup, onMount, Show } from "solid-js";
import "../styles.css";
import "../ui/ui.css";
import "./panel.css";
import "./toolbar/toolbar.css";
import "./request-list/request-list.css";
import "./detail/detail.css";
import "./rule-editor/rule-editor.css";
import { Icon } from "../ui/Icon";
import { IconButton } from "../ui/IconButton";
import { Input, ToggleSwitch } from "../ui/Controls";
import { MethodBadge } from "../ui/Badges";
import { EmptyState } from "../ui/EmptyState";
import { PanelToolbar } from "./toolbar/PanelToolbar";
import { RequestList } from "./request-list/RequestList";
import { RequestDetail } from "./detail/RequestDetail";
import { RuleEditor } from "./rule-editor/RuleEditor";
import {
  applyTrafficVisibility,
  requests,
  rules,
  send,
  setActiveTab,
  setDirectEditRule,
  setSelectedId,
  setShowRulesSidebar,
  setRules,
  showRulesSidebar,
  showToast,
  toast,
} from "./store";
import { usePort } from "./usePort";
import { initializeLanguage, language, t } from "../lib/i18n";
import { ruleMatchesRequest, truncate } from "../lib/request-utils";

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

function RulesSidebar() {
  let fileInput;

  const importRules = (event) => {
    const file = event.currentTarget.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (loadEvent) => {
      try {
        const parsed = JSON.parse(loadEvent.target.result);
        const list = Array.isArray(parsed) ? parsed : [parsed];
        send({ type: "IMPORT_RULES", rules: list });
        showToast(t("importedRules", { count: list.length }), "success");
      } catch (_) {
        showToast(t("invalidJSON"), "error");
      }
    };
    reader.readAsText(file);
    event.currentTarget.value = "";
  };

  return (
    <div id="rules-sidebar" classList={{ open: showRulesSidebar() }}>
      <div class="sidebar-header">
        <span>{t("savedRules")}</span>
        <div class="sidebar-actions">
          <IconButton icon="download" label={t("exportRules")} onClick={() => send({ type: "EXPORT_RULES" })}>{t("exportButton")}</IconButton>
          <IconButton icon="upload" label={t("importRules")} onClick={() => fileInput.click()}>{t("importButton")}</IconButton>
          <Input ref={fileInput} type="file" accept=".json" style={{ display: "none" }} onChange={importRules} />
          <IconButton icon="x" label={t("close")} onClick={() => setShowRulesSidebar(false)} />
        </div>
      </div>
      <div id="rules-list">
        <Show
          when={rules().length > 0}
          fallback={
            <EmptyState title={t("noRules")}>
              {t("noRulesPanel")} <strong>{t("ruleTab")}</strong>
            </EmptyState>
          }
        >
          <For each={rules()}>{(rule) => <RuleSidebarItem rule={rule} />}</For>
        </Show>
      </div>
    </div>
  );
}

function RuleSidebarItem(props) {
  const edit = () => {
    const matchingReq = [...requests()].reverse().find((req) => ruleMatchesRequest(props.rule, req));
    if (matchingReq) {
      setDirectEditRule(null);
      setSelectedId(matchingReq.id);
    } else {
      setDirectEditRule(props.rule);
      setSelectedId(null);
    }
    setActiveTab("rule");
  };

  return (
    <div class="rule-item" classList={{ disabled: !props.rule.enabled }} onClick={edit}>
      <ToggleSwitch
        label={`${props.rule.enabled ? t("disable") : t("enable")}: ${props.rule.name || props.rule.urlPattern || t("unnamed")}`}
        checked={!!props.rule.enabled}
        onClick={(event) => event.stopPropagation()}
        onChange={(checked) => send({ type: "TOGGLE_RULE", ruleId: props.rule.id, enabled: checked })}
      />
      <div class="rule-item-info">
        <span class="rule-name">
          {props.rule.name || props.rule.urlPattern || t("unnamed")}
          <Show when={props.rule.blockRequest}> <span class="rule-block-icon" role="img" aria-label={t("blockedRuleTitle")} title={t("blockedRuleTitle")}><Icon name="ban" size="sm" /></span></Show>
        </span>
        <div class="rule-meta">
          <Show when={props.rule.method && props.rule.method !== "*"}>
            <MethodBadge method={props.rule.method} />
          </Show>
          <Show when={props.rule.operationName}>
            <span class="graphql-op">{props.rule.operationName}</span>
          </Show>
          <span class="rule-url">{truncate(props.rule.urlPattern || "", 30)}</span>
        </div>
      </div>
      <span class="rule-edit-hint">{t("editRule")}</span>
      <IconButton
        icon="trash"
        label={t("delete")}
        class="rule-delete-btn"
        onClick={(event) => {
          event.stopPropagation();
          send({ type: "DELETE_RULE", ruleId: props.rule.id });
          showToast(t("ruleDeleted"), "success");
        }}
      />
    </div>
  );
}

document.getElementById("setup-hint")?.remove();
render(() => <PanelApp />, document.getElementById("root"));
