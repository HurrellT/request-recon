import { render } from "solid-js/web";
import { createEffect, createMemo, createSignal, For, Match, Show, Switch } from "solid-js";
import "../styles.css";
import "./panel.css";
import {
  activeTab,
  clearRequests,
  directEditRule,
  filterText,
  findMatchingRuleForRequest,
  findRule,
  isRecording,
  methodFilter,
  requests,
  rules,
  selectedRequest,
  send,
  setActiveTab,
  setDirectEditRule,
  setFilterText,
  setMethodFilter,
  setSelectedId,
  setShowRulesSidebar,
  setRules,
  showRulesSidebar,
  showToast,
  toast,
  visibleRequests,
} from "./store";
import { usePort } from "./usePort";
import {
  getBodySummary,
  getPath,
  getRequestLabel,
  headersToEntries,
  methodCSSClass,
  prettyJSON,
  ruleMatchesRequest,
  statusBadgeClass,
  statusDotClass,
  suggestBodyFilter,
  truncate,
  tryFormatJSON,
  urlToPattern,
} from "../lib/request-utils";

const HTTP_METHODS = ["GET", "POST", "PUT", "PATCH", "DELETE"];
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

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === "local" && changes.rules) {
      setRules(changes.rules.newValue || []);
    }
  });

  const activeRulesCount = createMemo(() => rules().filter((rule) => rule.enabled).length);

  return (
    <div id="app">
      <div id="toolbar">
        <button
          id="record-btn"
          classList={{ active: isRecording() }}
          title="Iniciar/detener la captura de red"
          onClick={() => send({ type: isRecording() ? "STOP" : "START" })}
        >
          <span id="record-dot" />
          <span id="record-label">{isRecording() ? "Detener" : "Iniciar"}</span>
        </button>
        <button class="toolbar-btn" title="Limpiar lista de requests" onClick={clearRequests}>
          Limpiar
        </button>
        <div class="separator" />
        <input
          type="text"
          id="filter-input"
          placeholder="Filtrar por URL u operación…"
          value={filterText()}
          onInput={(event) => setFilterText(event.currentTarget.value)}
        />
        <select
          id="method-filter"
          title="Filtrar por metodo HTTP"
          value={methodFilter()}
          onChange={(event) => setMethodFilter(event.currentTarget.value)}
        >
          <option value="">Todos</option>
          <For each={HTTP_METHODS}>{(method) => <option value={method}>{method}</option>}</For>
        </select>
        <div class="separator" />
        <button class="toolbar-btn" id="rules-toggle-btn" title="Ver reglas guardadas" onClick={() => setShowRulesSidebar((open) => !open)}>
          Reglas <Show when={activeRulesCount() > 0}><span id="rules-count">{activeRulesCount()}</span></Show>
        </button>
      </div>

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

function RequestList() {
  return (
    <div id="request-list-panel">
      <div id="request-list-header">
        <span>Requests</span>
        <span id="request-count">{visibleRequests().length}</span>
      </div>
      <div id="request-list">
        <Show
          when={visibleRequests().length > 0}
          fallback={
            <div class="empty-state">
              <div>{requests().length === 0 ? "Sin requests capturados" : "Sin coincidencias"}</div>
              <Show when={requests().length === 0}>
                <p>
                  Presiona <strong>Iniciar</strong> para comenzar
                </p>
              </Show>
            </div>
          }
        >
          <For each={visibleRequests()}>{(req) => <RequestItem req={req} />}</For>
        </Show>
      </div>
    </div>
  );
}

function RequestItem(props) {
  const matchedRule = createMemo(() => (props.req.ruleId ? findRule(props.req.ruleId) : null) ?? findMatchingRuleForRequest(props.req));
  const hasActiveRule = createMemo(() => !!matchedRule()?.enabled);
  const wasIntercepted = createMemo(() => props.req.ruleApplied === true || (!!(props.req.ruleId && hasActiveRule()) && props.req.ruleApplied == null));
  const subLabel = createMemo(() => {
    if (props.req.graphql) return { text: props.req.graphql.operationName || "GraphQL", isGql: true };
    const summary = getBodySummary(props.req);
    return summary ? { text: summary, isGql: false } : null;
  });

  return (
    <div
      class="request-item"
      classList={{
        selected: props.req.id === selectedRequest()?.id,
        modified: wasIntercepted(),
        "has-active-rule": !wasIntercepted() && hasActiveRule(),
      }}
      title={props.req.url}
      onClick={() => {
        setSelectedId(props.req.id);
        setDirectEditRule(null);
      }}
    >
      <div class="req-row-main">
        <span class={`method-badge ${methodCSSClass(props.req.method)}`}>{props.req.method}</span>
        <span class="request-url">{getPath(props.req.url)}</span>
        <span class={`status-dot ${statusDotClass(props.req.resStatus)}`} title={props.req.resStatus} />
        <Show when={wasIntercepted()}>
          <span class="rule-active-icon" title="Interceptada por regla">◆</span>
        </Show>
        <Show when={!wasIntercepted() && hasActiveRule()}>
          <span class="rule-active-icon rule-pending-icon" title="Regla activa — recargá para interceptar">◈</span>
        </Show>
      </div>
      <Show when={subLabel()}>
        {(label) => <div class="req-row-sub" classList={{ "is-gql": label().isGql }}>{label().text}</div>}
      </Show>
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
      return {
        method: req.method,
        methodClass: methodCSSClass(req.method),
        status: req.resStatus,
        statusClass: statusBadgeClass(req.resStatus),
        graphql: req.graphql?.operationName,
        modified: wasModified,
        url: req.url,
      };
    }

    const rule = direct();
    return {
      method: rule?.method && rule.method !== "*" ? rule.method : "-",
      methodClass: methodCSSClass(rule?.method || "other"),
      status: rule?.statusCode || "-",
      statusClass: "ok",
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
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
              <path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z" />
              <polyline points="13 2 13 9 20 9" />
            </svg>
            <div>Seleccioná un request para inspeccionarlo</div>
          </div>
        }
      >
        <div id="detail-header">
          <div class="detail-meta">
            <span class={`detail-method ${header().methodClass}`}>{header().method}</span>
            <span class={`status-badge ${header().statusClass}`}>{header().status}</span>
            <Show when={header().graphql}>
              <span class="detail-graphql-op">{header().graphql}</span>
            </Show>
            <Show when={header().modified}>
              <span class="modified-badge">⚡ Modificado</span>
            </Show>
          </div>
          <div id="detail-url">{header().url}</div>
        </div>
        <div id="tab-bar">
          <button class="tab-btn" classList={{ active: activeTab() === "request" }} onClick={() => setActiveTab("request")}>Request</button>
          <button class="tab-btn" classList={{ active: activeTab() === "response" }} onClick={() => setActiveTab("response")}>Respuesta</button>
          <button class="tab-btn" classList={{ active: activeTab() === "rule" }} onClick={() => setActiveTab("rule")}>Regla ✎</button>
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

function Section(props) {
  const [collapsed, setCollapsed] = createSignal(false);
  return (
    <div class="section" classList={{ collapsed: collapsed() }}>
      <div class="section-header" onClick={() => setCollapsed((value) => !value)}>
        <span>{props.title}</span>
        <span class="section-toggle">▾</span>
      </div>
      <div class="section-body">{props.children}</div>
    </div>
  );
}

function HeadersDisplay(props) {
  const entries = createMemo(() => headersToEntries(props.headers));
  return (
    <Show when={entries().length > 0} fallback={<span style={{ color: "var(--text-dim)" }}>Sin headers</span>}>
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
      <Section title="Headers del request">
        <HeadersDisplay headers={props.req.reqHeaders} />
      </Section>
      <Show when={props.req.reqBody?.trim()}>
        <Section title="Body del request">
          <pre class="code-block">{prettyJSON(props.req.reqBody)}</pre>
        </Section>
      </Show>
      <Show when={props.req.graphql}>
        <Section title="GraphQL">
          <Show when={props.req.graphql.operationName}>
            <div style={{ "margin-bottom": "8px" }}>
              <span style={{ color: "var(--text-muted)", "font-size": "11px" }}>Operación:</span>{" "}
              <strong style={{ color: "var(--purple)", "font-family": "var(--font-mono)" }}>{props.req.graphql.operationName}</strong>
            </div>
          </Show>
          <Show when={props.req.graphql.query}>
            <pre class="code-block">{props.req.graphql.query}</pre>
          </Show>
          <Show when={props.req.graphql.variables}>
            <div style={{ "margin-top": "8px", "font-size": "11px", color: "var(--text-muted)", "text-transform": "uppercase", "letter-spacing": ".4px" }}>Variables</div>
            <pre class="code-block" style={{ "margin-top": "4px" }}>{prettyJSON(JSON.stringify(props.req.graphql.variables))}</pre>
          </Show>
        </Section>
      </Show>
    </>
  );
}

function ResponseTab(props) {
  return (
    <>
      <Section title="Headers de respuesta">
        <HeadersDisplay headers={props.req.resHeaders} />
      </Section>
      <Section title="Body de respuesta">
        <Show when={props.req.resBody} fallback={<span style={{ color: "var(--text-dim)" }}>Sin body</span>}>
          <pre class="code-block">{prettyJSON(props.req.resBody)}</pre>
        </Show>
      </Section>
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
    showToast(ruleId() ? "Regla actualizada" : "Regla guardada", "success");
  };

  const deleteRule = () => {
    if (!ruleId()) return;
    send({ type: "DELETE_RULE", ruleId: ruleId() });
    setDirectEditRule(null);
    showToast("Regla eliminada", "success");
  };

  const applyBlockDefaults = (nextBlockRequest = blockRequest(), nextBlockType = blockType(), nextBlockStatus = blockStatus()) => {
    if (nextBlockRequest && nextBlockType !== "network-fail" && !responseBody().trim()) {
      setResponseBody(prettyJSON(`{"error":"Request bloqueado por Request Recon","status":${nextBlockStatus}}`));
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
          <Match when={wasIntercepted()}><div class="rule-banner intercepted">⚡ Esta request fue interceptada por esta regla.</div></Match>
          <Match when={existingRule()}><div class="rule-banner pending">◈ La regla matchea, pero esta request fue capturada antes de guardarla. Recargá la llamada para que tome efecto.</div></Match>
          <Match when={true}><div class="rule-banner new-rule">✎ Nueva regla — se guardará para requests futuras.</div></Match>
        </Switch>
      </Show>

      <Show when={diagnostics()}>{(diag) => <Diagnostics diag={diag()} />}</Show>

      <div class="form-group">
        <label>Nombre <span class="form-label-note">(etiqueta libre)</span></label>
        <input class="form-input" type="text" placeholder="Ej: GetCurrentAccounts — caso vacío" value={name()} onInput={(event) => setName(event.currentTarget.value)} />
      </div>

      <div class="form-group">
        <label>URL Pattern <span class="form-label-note">(regex)</span></label>
        <input class="form-input" type="text" spellcheck={false} value={urlPattern()} onInput={(event) => setUrlPattern(event.currentTarget.value)} />
        <div class="form-hint">Usá expresiones regulares. Ej: <code>/api/users</code> o <code>api\.example\.com/graphql</code></div>
      </div>

      <div class="form-row">
        <div class="form-group">
          <label>Método HTTP</label>
          <select class="form-select" value={method()} onChange={(event) => setMethod(event.currentTarget.value)}>
            <option value="*">Cualquiera (*)</option>
            <For each={HTTP_METHODS}>{(item) => <option value={item}>{item}</option>}</For>
          </select>
        </div>
        <div class="form-group">
          <label>Status Code</label>
          <input class="form-input" type="number" min="100" max="599" value={statusCode()} onInput={(event) => setStatusCode(event.currentTarget.value)} />
        </div>
      </div>

      <Show when={showGraphQL()}>
        <div class="form-group">
          <label>GraphQL Operation Name</label>
          <input class="form-input" type="text" placeholder="Dejar vacío para interceptar todas las operaciones de esta URL" value={operationName()} onInput={(event) => setOperationName(event.currentTarget.value)} />
          <div class="form-hint">Ej: <code>GetUser</code>, <code>CreateOrder</code></div>
        </div>
      </Show>

      <div class="form-group">
        <label>Body del request contiene <span class="form-label-note">(opcional)</span></label>
        <input class="form-input" type="text" spellcheck={false} placeholder={'Ej: "status":"pending"  —  vacío = aplica a todos los requests de esta URL'} value={bodyContains()} onInput={(event) => setBodyContains(event.currentTarget.value)} />
        <div class="form-hint">Filtra por substring del request body. Útil para distinguir requests al mismo endpoint con distintos parámetros.</div>
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
          <span>Simular error / bloquear request</span>
        </label>
        <div class="form-hint">Retorna un error en lugar de la respuesta del servidor. Para GraphQL usá el campo Operation Name para bloquear solo una operación.</div>
      </div>

      <Show when={blockRequest()}>
        <div style={{ display: "flex", "flex-direction": "column", gap: "12px" }}>
          <div class="form-row">
            <div class="form-group">
              <label>Tipo de error</label>
              <select
                class="form-select"
                value={blockType()}
                onChange={(event) => {
                  setBlockType(event.currentTarget.value);
                  applyBlockDefaults(blockRequest(), event.currentTarget.value);
                }}
              >
                <option value="http-error">Error HTTP (respuesta con código de error)</option>
                <option value="network-fail">Error de red (sin respuesta)</option>
              </select>
            </div>
            <Show when={blockType() !== "network-fail"}>
              <div class="form-group">
                <label>Status Code</label>
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
            <label>Response Body</label>
            <div style={{ display: "flex", gap: "4px" }}>
              <button
                class="btn-icon"
                title="Formatear JSON"
                onClick={() => {
                  const formatted = tryFormatJSON(responseBody());
                  if (formatted !== null) setResponseBody(formatted);
                  else showToast("JSON invalido - no se puede formatear", "error");
                }}
              >
                {"{ }"}
              </button>
              <Show when={props.req?.resBody}>
                <button class="btn-icon" title="Restaurar respuesta original" onClick={() => setResponseBody(prettyJSON(props.req?.resBody ?? ""))}>
                  ↩ Reset
                </button>
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
            <span>Habilitar regla</span>
          </label>
        </Show>
        <div class="btn-group">
          <Show when={ruleId()}>
            <button class="btn btn-danger" onClick={deleteRule}>Eliminar</button>
          </Show>
          <button class="btn btn-primary" onClick={save}>{ruleId() ? "Actualizar regla" : "Guardar regla"}</button>
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
      summary: `Diagnostico de matching (${matchCount} request${matchCount !== 1 ? "s" : ""} coinciden)`,
      hint: `La regla matchea ${matchCount} request${matchCount !== 1 ? "s" : ""} capturada${matchCount !== 1 ? "s" : ""}. Recarga la llamada para interceptarla.`,
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
  rows.push({ ok: urlOk, label: "URL Pattern", value: rule.urlPattern || "(cualquiera)" });

  const methodOk = !rule.method || rule.method === "*" || (candidate && rule.method.toUpperCase() === candidate.method.toUpperCase());
  rows.push({ ok: methodOk, label: "Metodo", value: rule.method || "*", actual: candidate ? `request: ${candidate.method}` : "" });

  if (rule.operationName) {
    const opOk = candidate && candidate.graphql?.operationName === rule.operationName;
    rows.push({ ok: opOk, label: "Operation Name", value: rule.operationName, actual: candidate ? `request: ${candidate.graphql?.operationName ?? "-"}` : "" });
  }

  if (rule.bodyContains?.trim()) {
    const bodyOk = candidate && candidate.reqBody?.includes(rule.bodyContains.trim());
    rows.push({ ok: bodyOk, label: "Body contiene", value: rule.bodyContains });
  }

  return {
    summary: `Diagnostico de matching (0 de ${requests().length} requests coinciden)`,
    hint: !candidate ? "No hay requests capturadas para comparar." : "Comparando contra el request mas reciente a esta URL.",
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
                  <td class="diag-icon">{row.ok ? "✅" : "❌"}</td>
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
        showToast(`${list.length} regla(s) importada(s)`, "success");
      } catch (_) {
        showToast("JSON inválido", "error");
      }
    };
    reader.readAsText(file);
    event.currentTarget.value = "";
  };

  return (
    <div id="rules-sidebar" classList={{ open: showRulesSidebar() }}>
      <div class="sidebar-header">
        <span>Reglas guardadas</span>
        <div class="sidebar-actions">
          <button class="btn-icon" title="Exportar reglas como JSON" onClick={() => send({ type: "EXPORT_RULES" })}>↑ Export</button>
          <button class="btn-icon" title="Importar reglas desde JSON" onClick={() => fileInput.click()}>↓ Import</button>
          <input ref={fileInput} type="file" accept=".json" style={{ display: "none" }} onChange={importRules} />
          <button class="btn-icon" title="Cerrar" onClick={() => setShowRulesSidebar(false)}>✕</button>
        </div>
      </div>
      <div id="rules-list">
        <Show
          when={rules().length > 0}
          fallback={
            <div class="empty-state">
              <div>Sin reglas configuradas</div>
              <p>
                Seleccioná un request y guardá una regla desde la pestaña <strong>Regla ✎</strong>
              </p>
            </div>
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
      <label class="toggle-switch" title={props.rule.enabled ? "Deshabilitar" : "Habilitar"} onClick={(event) => event.stopPropagation()}>
        <input
          type="checkbox"
          checked={!!props.rule.enabled}
          onChange={(event) => send({ type: "TOGGLE_RULE", ruleId: props.rule.id, enabled: event.currentTarget.checked })}
        />
        <span class="toggle-slider" />
      </label>
      <div class="rule-item-info">
        <span class="rule-name">
          {props.rule.name || props.rule.urlPattern || "(sin nombre)"}
          <Show when={props.rule.blockRequest}> <span style={{ color: "var(--red)", "font-size": "10px" }}>⊘</span></Show>
        </span>
        <div class="rule-meta">
          <Show when={props.rule.method && props.rule.method !== "*"}>
            <span class={`method-badge ${methodCSSClass(props.rule.method)}`}>{props.rule.method}</span>
          </Show>
          <Show when={props.rule.operationName}>
            <span class="graphql-op">{props.rule.operationName}</span>
          </Show>
          <span class="rule-url">{truncate(props.rule.urlPattern || "", 30)}</span>
        </div>
      </div>
      <span class="rule-edit-hint">✎ editar</span>
      <button
        class="btn-icon rule-delete-btn"
        title="Eliminar regla"
        onClick={(event) => {
          event.stopPropagation();
          send({ type: "DELETE_RULE", ruleId: props.rule.id });
          showToast("Regla eliminada", "success");
        }}
      >
        ✕
      </button>
    </div>
  );
}

render(() => <PanelApp />, document.getElementById("root"));
