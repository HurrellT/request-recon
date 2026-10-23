import { render } from "solid-js/web";
import { createEffect, createMemo, createSignal, For, Match, onCleanup, onMount, Show, Switch } from "solid-js";
import "../styles.css";
import "../ui/ui.css";
import "./panel.css";
import "./toolbar/toolbar.css";
import "./request-list/request-list.css";
import "./detail/detail.css";
import { Icon } from "../ui/Icon";
import { IconButton } from "../ui/IconButton";
import { Button, CheckboxField, FormField, Input, Select, TextArea, ToggleSwitch } from "../ui/Controls";
import { MethodBadge, StatusBadge } from "../ui/Badges";
import { EmptyState } from "../ui/EmptyState";
import { PanelToolbar } from "./toolbar/PanelToolbar";
import { RequestList } from "./request-list/RequestList";
import { RequestDetail } from "./detail/RequestDetail";
import {
  applyTrafficVisibility,
  directEditRule,
  findMatchingRuleForRequest,
  findRule,
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
import {
  HTTP_METHODS,
  getPath,
  prettyJSON,
  ruleMatchesRequest,
  suggestBodyFilter,
  truncate,
  tryFormatJSON,
  urlToPattern,
} from "../lib/request-utils";

const ERROR_STATUSES = [
  [400, "400 Bad Request"],
  [401, "401 Unauthorized"],
  [403, "403 Forbidden"],
  [404, "404 Not Found"],
  [429, "429 Too Many Requests"],
  [500, "500 Internal Server Error"],
  [502, "502 Bad Gateway"],
  [503, "503 Service Unavailable"],
  [504, "504 Gateway Timeout"],
];

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

function RuleEditor(props) {
  const existingRule = createMemo(() => props.directRule ?? (props.req?.ruleId ? findRule(props.req.ruleId) : null) ?? (props.req ? findMatchingRuleForRequest(props.req) : null));
  const [name, setName] = createSignal("");
  const [urlPattern, setUrlPattern] = createSignal("");
  const [method, setMethod] = createSignal("*");
  const [operationName, setOperationName] = createSignal("");
  const [bodyContains, setBodyContains] = createSignal("");
  const [statusCode, setStatusCode] = createSignal(200);
  const [responseBody, setResponseBody] = createSignal("");
  const [enabled, setEnabled] = createSignal(true);
  const [blockRequest, setBlockRequest] = createSignal(false);
  const [blockType, setBlockType] = createSignal("http-error");
  const [blockStatus, setBlockStatus] = createSignal(500);

  createEffect(() => {
    const rule = existingRule();
    setName(rule?.name ?? props.req?.graphql?.operationName ?? getPath(props.req?.url ?? "") ?? "");
    setUrlPattern(rule?.urlPattern ?? (props.req ? urlToPattern(props.req.url) : ""));
    setMethod(rule?.method ?? props.req?.method ?? "*");
    setOperationName(rule?.operationName ?? props.req?.graphql?.operationName ?? "");
    setBodyContains(rule?.bodyContains ?? suggestBodyFilter(props.req));
    setStatusCode(rule?.statusCode ?? props.req?.resStatus ?? 200);
    setResponseBody(prettyJSON(rule?.resBody ?? props.req?.resBody ?? ""));
    setEnabled(rule?.enabled ?? true);
    setBlockRequest(rule?.blockRequest ?? false);
    setBlockType(rule?.blockType ?? "http-error");
    setBlockStatus(rule?.blockStatus ?? 500);
  });

  const ruleId = createMemo(() => existingRule()?.id ?? null);
  const showGraphQL = createMemo(() => (props.req ? props.req.graphql !== null : !!(existingRule()?.operationName != null)));
  const wasIntercepted = createMemo(() => !!(props.req?.ruleId && existingRule() && props.req.ruleId === existingRule().id));
  const diagnostics = createMemo(() => buildDiagnostics(existingRule()));

  const save = () => {
    const opValue = operationName().trim() || null;
    const isBlock = blockRequest();
    const blockStatusValue = parseInt(blockStatus(), 10);
    const rule = {
      id: ruleId() || crypto.randomUUID(),
      name: name().trim() || opValue || props.req?.graphql?.operationName || getPath(urlPattern()) || urlPattern(),
      urlPattern: urlPattern().trim(),
      method: method(),
      operationName: opValue,
      bodyContains: bodyContains().trim() || null,
      resBody: responseBody(),
      statusCode: isBlock && blockType() !== "network-fail" ? blockStatusValue : parseInt(statusCode(), 10) || 200,
      enabled: ruleId() ? enabled() : true,
      resHeaders: null,
      blockRequest: isBlock,
      blockType: blockType(),
      blockStatus: blockStatusValue,
    };
    setDirectEditRule(rule);
    send({ type: "SAVE_RULE", rule });
    showToast(ruleId() ? t("ruleUpdated") : t("ruleSaved"), "success");
  };

  const deleteRule = () => {
    if (!ruleId()) return;
    send({ type: "DELETE_RULE", ruleId: ruleId() });
    setDirectEditRule(null);
    showToast(t("ruleDeleted"), "success");
  };

  const applyBlockDefaults = (nextBlockRequest = blockRequest(), nextBlockType = blockType(), nextBlockStatus = blockStatus()) => {
    if (nextBlockRequest && nextBlockType !== "network-fail" && !responseBody().trim()) {
      setResponseBody(prettyJSON(JSON.stringify({ error: t("blockedRequest"), status: Number(nextBlockStatus) })));
    }
  };

  const updateBlockStatus = (value) => {
    setBlockStatus(value);
    if (blockRequest() && blockType() !== "network-fail") {
      try {
        const parsed = JSON.parse(responseBody());
        if (parsed.status !== undefined) {
          parsed.status = parseInt(value, 10);
          setResponseBody(JSON.stringify(parsed, null, 2));
        }
      } catch (_) {}
    }
    applyBlockDefaults(blockRequest(), blockType(), value);
  };

  return (
    <div class="rule-editor">
      <Show when={props.req}>
        <Switch>
          <Match when={wasIntercepted()}><div class="rule-banner intercepted"><Icon name="bolt" />{t("interceptedBanner")}</div></Match>
          <Match when={existingRule()}><div class="rule-banner pending"><Icon name="clock" />{t("pendingBanner")}</div></Match>
          <Match when={true}><div class="rule-banner new-rule"><Icon name="pencil" />{t("newRuleBanner")}</div></Match>
        </Switch>
      </Show>

      <Show when={diagnostics()}>{(diag) => <Diagnostics diag={diag()} />}</Show>

      <FormField label={t("name")} note={t("freeLabel")}>
        {({ id }) => <Input id={id} variant="form" type="text" placeholder={t("namePlaceholder")} value={name()} onInput={(event) => setName(event.currentTarget.value)} />}
      </FormField>

      <FormField label={t("urlPattern")} note="(regex)" hint={<>{t("regexHint")} <code>/api/users</code> {t("or")} <code>api\.example\.com/graphql</code></>}>
        {({ id, describedBy }) => <Input id={id} aria-describedby={describedBy} variant="form" type="text" spellcheck={false} value={urlPattern()} onInput={(event) => setUrlPattern(event.currentTarget.value)} />}
      </FormField>

      <div class="form-row">
        <FormField label={t("httpMethod")}>
          {({ id }) => (
            <Select id={id} variant="form" value={method()} onChange={(event) => setMethod(event.currentTarget.value)}>
              <option value="*">{t("anyMethod")}</option>
              <For each={HTTP_METHODS}>{(item) => <option value={item}>{item}</option>}</For>
            </Select>
          )}
        </FormField>
        <FormField label={t("statusCode")}>
          {({ id }) => <Input id={id} variant="form" type="number" min="100" max="599" value={statusCode()} onInput={(event) => setStatusCode(event.currentTarget.value)} />}
        </FormField>
      </div>

      <Show when={showGraphQL()}>
        <FormField label={t("graphqlOperation")} hint={<>{t("example")} <code>GetUser</code>, <code>CreateOrder</code></>}>
          {({ id, describedBy }) => <Input id={id} aria-describedby={describedBy} variant="form" type="text" placeholder={t("operationPlaceholder")} value={operationName()} onInput={(event) => setOperationName(event.currentTarget.value)} />}
        </FormField>
      </Show>

      <FormField label={t("bodyContains")} note={t("optional")} hint={t("bodyContainsHint")}>
        {({ id, describedBy }) => <Input id={id} aria-describedby={describedBy} variant="form" type="text" spellcheck={false} placeholder={t("bodyContainsPlaceholder")} value={bodyContains()} onInput={(event) => setBodyContains(event.currentTarget.value)} />}
      </FormField>

      <div class="form-group">
        <CheckboxField
          label={t("simulateError")}
          hint={t("simulateErrorHint")}
          checked={blockRequest()}
          onChange={(checked) => {
            setBlockRequest(checked);
            applyBlockDefaults(checked);
          }}
        />
      </div>

      <Show when={blockRequest()}>
        <div style={{ display: "flex", "flex-direction": "column", gap: "12px" }}>
          <div class="form-row">
            <FormField label={t("errorType")}>
              {({ id }) => (
                <Select id={id} variant="form" value={blockType()} onChange={(event) => {
                  setBlockType(event.currentTarget.value);
                  applyBlockDefaults(blockRequest(), event.currentTarget.value);
                }}>
                  <option value="http-error">{t("httpError")}</option>
                  <option value="network-fail">{t("networkError")}</option>
                </Select>
              )}
            </FormField>
            <Show when={blockType() !== "network-fail"}>
              <FormField label={t("statusCode")}>
                {({ id }) => (
                  <Select id={id} variant="form" value={blockStatus()} onChange={(event) => updateBlockStatus(event.currentTarget.value)}>
                    <For each={ERROR_STATUSES}>{([value, label]) => <option value={value}>{label}</option>}</For>
                  </Select>
                )}
              </FormField>
            </Show>
          </div>
        </div>
      </Show>

      <Show when={!(blockRequest() && blockType() === "network-fail")}>
        <FormField
          label={t("responseBody")}
          actions={
            <div style={{ display: "flex", gap: "4px" }}>
              <IconButton
                icon="braces"
                label={t("formatJSON")}
                onClick={() => {
                  const formatted = tryFormatJSON(responseBody());
                  if (formatted !== null) setResponseBody(formatted);
                  else showToast(t("invalidJSONFormat"), "error");
                }}
              />
              <Show when={props.req?.resBody}>
                <IconButton icon="restore" label={t("restoreResponse")} onClick={() => setResponseBody(prettyJSON(props.req?.resBody ?? ""))}>
                  {t("reset")}
                </IconButton>
              </Show>
            </div>
          }
        >
          {({ id }) => <TextArea id={id} variant="form" rows="12" spellcheck={false} value={responseBody()} onInput={(event) => setResponseBody(event.currentTarget.value)} />}
        </FormField>
      </Show>

      <div class="rule-actions">
        <Show when={ruleId()} fallback={<span />}>
          <CheckboxField label={t("enableRule")} checked={enabled()} onChange={setEnabled} />
        </Show>
        <div class="btn-group">
          <Show when={ruleId()}>
            <Button variant="danger" onClick={deleteRule}>{t("delete")}</Button>
          </Show>
          <Button variant="primary" onClick={save}>{ruleId() ? t("updateRule") : t("saveRule")}</Button>
        </div>
      </div>
    </div>
  );
}

function buildDiagnostics(rule) {
  if (!rule || requests().length === 0) return null;
  const matchCount = requests().filter((req) => ruleMatchesRequest(rule, req)).length;
  const candidate = [...requests()].reverse().find((req) => {
    if (!req.url || !rule.urlPattern) return false;
    try {
      return new RegExp(rule.urlPattern, "i").test(req.url);
    } catch (_) {
      return false;
    }
  });

  if (matchCount > 0) {
    return {
      summary: t("diagnosticsMatched", { count: matchCount }),
      hint: t("diagnosticsMatchedHint", { count: matchCount }),
      rows: [],
      open: false,
    };
  }

  const rows = [];
  const urlOk = (() => {
    if (!rule.urlPattern) return true;
    try {
      return new RegExp(rule.urlPattern, "i").test(candidate?.url ?? "");
    } catch (_) {
      return false;
    }
  })();
  rows.push({ ok: urlOk, label: t("urlPattern"), value: rule.urlPattern || t("any") });

  const methodOk = !rule.method || rule.method === "*" || (candidate && rule.method.toUpperCase() === candidate.method.toUpperCase());
  rows.push({ ok: methodOk, label: t("method"), value: rule.method || "*", actual: candidate ? t("requestMethodActual", { method: candidate.method }) : "" });

  if (rule.operationName) {
    const opOk = candidate && candidate.graphql?.operationName === rule.operationName;
    rows.push({ ok: opOk, label: t("graphqlOperation"), value: rule.operationName, actual: candidate ? t("requestOperationActual", { operation: candidate.graphql?.operationName ?? "-" }) : "" });
  }

  if (rule.bodyContains?.trim()) {
    const bodyOk = candidate && candidate.reqBody?.includes(rule.bodyContains.trim());
    rows.push({ ok: bodyOk, label: t("bodyContainsShort"), value: rule.bodyContains });
  }

  return {
    summary: t("diagnosticsNone", { count: requests().length }),
    hint: !candidate ? t("noCapturedCompare") : t("comparingLatest"),
    rows,
    open: true,
  };
}

function Diagnostics(props) {
  return (
    <details class="rule-diag" open={props.diag.open}>
      <summary>{props.diag.summary}</summary>
      <p class="diag-hint">{props.diag.hint}</p>
      <Show when={props.diag.rows.length > 0}>
        <table class="diag-table">
          <tbody>
            <For each={props.diag.rows}>
              {(row) => (
                <tr>
                  <td class={`diag-icon ${row.ok ? "pass" : "fail"}`}>
                    <Icon name={row.ok ? "circle-check" : "circle-x"} />
                    <span class="sr-only">{row.ok ? t("diagnosticPass") : t("diagnosticFail")}</span>
                  </td>
                  <td class="diag-label">{row.label}</td>
                  <td class="diag-value">
                    {row.value}
                    <Show when={row.actual}><span class="diag-actual">({row.actual})</span></Show>
                  </td>
                </tr>
              )}
            </For>
          </tbody>
        </table>
      </Show>
    </details>
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
