import { render } from "solid-js/web";
import { createEffect, createMemo, createSignal, For, Match, onCleanup, onMount, Show, Switch } from "solid-js";
import "../styles.css";
import "../ui/ui.css";
import "./panel.css";
import "./toolbar/toolbar.css";
import "./request-list/request-list.css";
import { Icon } from "../ui/Icon";
import { IconButton } from "../ui/IconButton";
import { MethodBadge, StatusBadge } from "../ui/Badges";
import { EmptyState } from "../ui/EmptyState";
import { CollapsibleSection } from "../ui/CollapsibleSection";
import { PanelToolbar } from "./toolbar/PanelToolbar";
import { RequestList } from "./request-list/RequestList";
import {
  activeTab,
  applyTrafficVisibility,
  directEditRule,
  findMatchingRuleForRequest,
  findRule,
  requests,
  rules,
  selectedRequest,
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
  getResponseOutcome,
  headersToEntries,
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
        <DetailPanel />
        <RulesSidebar />
      </div>

      <div id="toast" classList={{ show: !!toast(), success: toast()?.type === "success", error: toast()?.type === "error" }}>
        {toast()?.message}
      </div>
    </div>
  );
}

function DetailPanel() {
  const current = createMemo(() => selectedRequest());
  const direct = createMemo(() => directEditRule());
  const hasDetail = createMemo(() => !!current() || !!direct());
  const header = createMemo(() => {
    const req = current();
    if (req) {
      const wasModified = req.ruleApplied === true || (req.ruleApplied == null && !!(req.ruleId && findRule(req.ruleId)?.enabled));
      const outcome = getResponseOutcome(req);
      return {
        method: req.method,
        status: outcome.networkFailure ? t("networkFailureShort") : outcome.status ?? "-",
        statusTone: outcome.networkFailure ? "error" : undefined,
        graphql: req.graphql?.operationName,
        modified: wasModified,
        url: req.url,
      };
    }

    const rule = direct();
    return {
      method: rule?.method && rule.method !== "*" ? rule.method : "-",
      status: rule?.statusCode || "-",
      statusTone: undefined,
      graphql: rule?.operationName,
      modified: false,
      url: rule?.urlPattern || rule?.name || "",
    };
  });

  return (
    <div id="detail-panel">
      <Show
        when={hasDetail()}
        fallback={
          <div id="no-selection">
            <Icon name="file-description" size="lg" />
            <div>{t("selectRequest")}</div>
          </div>
        }
      >
        <div id="detail-header">
          <div class="detail-meta">
            <MethodBadge method={header().method} detail />
            <StatusBadge status={header().status} tone={header().statusTone} />
            <Show when={header().graphql}>
              <span class="detail-graphql-op">{header().graphql}</span>
            </Show>
            <Show when={header().modified}>
              <span class="modified-badge"><Icon name="bolt" size="sm" /> {t("modified")}</span>
            </Show>
          </div>
          <div id="detail-url">{header().url}</div>
        </div>
        <div id="tab-bar">
          <button class="tab-btn" classList={{ active: activeTab() === "request" }} onClick={() => setActiveTab("request")}>{t("requestTab")}</button>
          <button class="tab-btn" classList={{ active: activeTab() === "response" }} onClick={() => setActiveTab("response")}>{t("responseTab")}</button>
          <button class="tab-btn" classList={{ active: activeTab() === "rule" }} onClick={() => setActiveTab("rule")}>{t("ruleTab")}</button>
        </div>
        <div id="tab-content">
          <Show when={current()} fallback={<RuleEditor req={null} directRule={direct()} />}>
            {(req) => (
              <Switch>
                <Match when={activeTab() === "request"}><RequestTab req={req()} /></Match>
                <Match when={activeTab() === "rule"}><RuleEditor req={req()} directRule={null} /></Match>
                <Match when={true}><ResponseTab req={req()} /></Match>
              </Switch>
            )}
          </Show>
        </div>
      </Show>
    </div>
  );
}

function HeadersDisplay(props) {
  const entries = createMemo(() => headersToEntries(props.headers));
  return (
    <Show when={entries().length > 0} fallback={<span style={{ color: "var(--text-dim)" }}>{t("noHeaders")}</span>}>
      <div class="headers-grid">
        <For each={entries()}>
          {([key, value]) => (
            <>
              <span class="header-name">{key}</span>
              <span class="header-value">{value}</span>
            </>
          )}
        </For>
      </div>
    </Show>
  );
}

function RequestTab(props) {
  return (
    <>
      <CollapsibleSection title={t("requestHeaders")}>
        <HeadersDisplay headers={props.req.reqHeaders} />
      </CollapsibleSection>
      <Show when={props.req.reqBody?.trim()}>
        <CollapsibleSection title={t("requestBody")}>
          <pre class="code-block">{prettyJSON(props.req.reqBody)}</pre>
        </CollapsibleSection>
      </Show>
      <Show when={props.req.graphql}>
        <CollapsibleSection title="GraphQL">
          <Show when={props.req.graphql.operationName}>
            <div style={{ "margin-bottom": "8px" }}>
              <span style={{ color: "var(--text-muted)", "font-size": "11px" }}>{t("operation")}</span>{" "}
              <strong style={{ color: "var(--purple)", "font-family": "var(--font-mono)" }}>{props.req.graphql.operationName}</strong>
            </div>
          </Show>
          <Show when={props.req.graphql.query}>
            <pre class="code-block">{props.req.graphql.query}</pre>
          </Show>
          <Show when={props.req.graphql.variables}>
            <div style={{ "margin-top": "8px", "font-size": "11px", color: "var(--text-muted)", "text-transform": "uppercase", "letter-spacing": ".4px" }}>{t("variables")}</div>
            <pre class="code-block" style={{ "margin-top": "4px" }}>{prettyJSON(JSON.stringify(props.req.graphql.variables))}</pre>
          </Show>
        </CollapsibleSection>
      </Show>
    </>
  );
}

function ResponseTab(props) {
  return (
    <>
      <CollapsibleSection title={t("responseHeaders")}>
        <HeadersDisplay headers={props.req.resHeaders} />
      </CollapsibleSection>
      <CollapsibleSection title={t("responseBodySection")}>
        <Show when={props.req.resBody} fallback={<span style={{ color: "var(--text-dim)" }}>{t("noBody")}</span>}>
          <pre class="code-block">{prettyJSON(props.req.resBody)}</pre>
        </Show>
      </CollapsibleSection>
    </>
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

      <div class="form-group">
        <label>{t("name")} <span class="form-label-note">{t("freeLabel")}</span></label>
        <input class="form-input" type="text" placeholder={t("namePlaceholder")} value={name()} onInput={(event) => setName(event.currentTarget.value)} />
      </div>

      <div class="form-group">
        <label>{t("urlPattern")} <span class="form-label-note">(regex)</span></label>
        <input class="form-input" type="text" spellcheck={false} value={urlPattern()} onInput={(event) => setUrlPattern(event.currentTarget.value)} />
        <div class="form-hint">{t("regexHint")} <code>/api/users</code> {t("or")} <code>api\.example\.com/graphql</code></div>
      </div>

      <div class="form-row">
        <div class="form-group">
          <label>{t("httpMethod")}</label>
          <select class="form-select" value={method()} onChange={(event) => setMethod(event.currentTarget.value)}>
            <option value="*">{t("anyMethod")}</option>
            <For each={HTTP_METHODS}>{(item) => <option value={item}>{item}</option>}</For>
          </select>
        </div>
        <div class="form-group">
          <label>{t("statusCode")}</label>
          <input class="form-input" type="number" min="100" max="599" value={statusCode()} onInput={(event) => setStatusCode(event.currentTarget.value)} />
        </div>
      </div>

      <Show when={showGraphQL()}>
        <div class="form-group">
          <label>{t("graphqlOperation")}</label>
          <input class="form-input" type="text" placeholder={t("operationPlaceholder")} value={operationName()} onInput={(event) => setOperationName(event.currentTarget.value)} />
          <div class="form-hint">{t("example")} <code>GetUser</code>, <code>CreateOrder</code></div>
        </div>
      </Show>

      <div class="form-group">
        <label>{t("bodyContains")} <span class="form-label-note">{t("optional")}</span></label>
        <input class="form-input" type="text" spellcheck={false} placeholder={t("bodyContainsPlaceholder")} value={bodyContains()} onInput={(event) => setBodyContains(event.currentTarget.value)} />
        <div class="form-hint">{t("bodyContainsHint")}</div>
      </div>

      <div class="form-group">
        <label class="toggle-label">
          <input
            type="checkbox"
            checked={blockRequest()}
            onChange={(event) => {
              setBlockRequest(event.currentTarget.checked);
              applyBlockDefaults(event.currentTarget.checked);
            }}
          />
          <span>{t("simulateError")}</span>
        </label>
        <div class="form-hint">{t("simulateErrorHint")}</div>
      </div>

      <Show when={blockRequest()}>
        <div style={{ display: "flex", "flex-direction": "column", gap: "12px" }}>
          <div class="form-row">
            <div class="form-group">
              <label>{t("errorType")}</label>
              <select
                class="form-select"
                value={blockType()}
                onChange={(event) => {
                  setBlockType(event.currentTarget.value);
                  applyBlockDefaults(blockRequest(), event.currentTarget.value);
                }}
              >
                <option value="http-error">{t("httpError")}</option>
                <option value="network-fail">{t("networkError")}</option>
              </select>
            </div>
            <Show when={blockType() !== "network-fail"}>
              <div class="form-group">
                <label>{t("statusCode")}</label>
                <select class="form-select" value={blockStatus()} onChange={(event) => updateBlockStatus(event.currentTarget.value)}>
                  <For each={ERROR_STATUSES}>{([value, label]) => <option value={value}>{label}</option>}</For>
                </select>
              </div>
            </Show>
          </div>
        </div>
      </Show>

      <Show when={!(blockRequest() && blockType() === "network-fail")}>
        <div class="form-group">
          <div class="body-header">
            <label>{t("responseBody")}</label>
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
          </div>
          <textarea class="form-textarea" rows="12" spellcheck={false} value={responseBody()} onInput={(event) => setResponseBody(event.currentTarget.value)} />
        </div>
      </Show>

      <div class="rule-actions">
        <Show when={ruleId()} fallback={<span />}>
          <label class="toggle-label">
            <input type="checkbox" checked={enabled()} onChange={(event) => setEnabled(event.currentTarget.checked)} />
            <span>{t("enableRule")}</span>
          </label>
        </Show>
        <div class="btn-group">
          <Show when={ruleId()}>
            <button class="btn btn-danger" onClick={deleteRule}>{t("delete")}</button>
          </Show>
          <button class="btn btn-primary" onClick={save}>{ruleId() ? t("updateRule") : t("saveRule")}</button>
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
          <input ref={fileInput} type="file" accept=".json" style={{ display: "none" }} onChange={importRules} />
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
      <label class="toggle-switch" title={props.rule.enabled ? t("disable") : t("enable")} onClick={(event) => event.stopPropagation()}>
        <input
          type="checkbox"
          checked={!!props.rule.enabled}
          onChange={(event) => send({ type: "TOGGLE_RULE", ruleId: props.rule.id, enabled: event.currentTarget.checked })}
        />
        <span class="toggle-slider" />
      </label>
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
