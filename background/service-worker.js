// ─── State ────────────────────────────────────────────────────────────────────
// Maps survive as long as the SW is alive. Keepalive pings from the panel
// prevent Chrome from killing the SW while DevTools is open.

const activeSessions = new Set(); // tabId
const panelPorts = new Map();     // tabId -> Port

// ─── Port / message handling ──────────────────────────────────────────────────

chrome.runtime.onConnect.addListener((port) => {
  const match = port.name.match(/^panel-(\d+)$/);
  if (!match) return;

  const tabId = parseInt(match[1], 10);
  panelPorts.set(tabId, port);

  port.onMessage.addListener((msg) => handlePanelMsg(tabId, msg, port));
  port.onDisconnect.addListener(() => panelPorts.delete(tabId));

  // Send current status immediately so the panel can sync on reconnect
  port.postMessage({ type: 'STATUS', active: activeSessions.has(tabId) });
  loadRules().then((rules) => port.postMessage({ type: 'RULES', rules }));
});

async function handlePanelMsg(tabId, msg, port) {
  switch (msg.type) {
    case 'START': {
      const err = await startSession(tabId);
      if (err) port.postMessage({ type: 'ERROR', message: err });
      else port.postMessage({ type: 'STATUS', active: true });
      break;
    }
    case 'STOP': {
      await stopSession(tabId);
      port.postMessage({ type: 'STATUS', active: false });
      break;
    }
    case 'GET_RULES': {
      const rules = await loadRules();
      port.postMessage({ type: 'RULES', rules });
      break;
    }
    case 'SAVE_RULE': {
      const rules = await upsertRule(msg.rule);
      port.postMessage({ type: 'RULES', rules });
      break;
    }
    case 'DELETE_RULE': {
      const rules = await deleteRule(msg.ruleId);
      port.postMessage({ type: 'RULES', rules });
      break;
    }
    case 'TOGGLE_RULE': {
      const rules = await toggleRule(msg.ruleId, msg.enabled);
      port.postMessage({ type: 'RULES', rules });
      break;
    }
    case 'EXPORT_RULES': {
      const rules = await loadRules();
      port.postMessage({ type: 'EXPORT_DATA', data: JSON.stringify(rules, null, 2) });
      break;
    }
    case 'IMPORT_RULES': {
      const rules = await importRules(msg.rules);
      port.postMessage({ type: 'RULES', rules });
      break;
    }
    case 'KEEPALIVE':
      // Intentionally empty — just prevents the SW from being terminated
      break;
  }
}

// ─── Debugger session management ──────────────────────────────────────────────

async function startSession(tabId) {
  if (activeSessions.has(tabId)) return null;

  try {
    await chrome.debugger.attach({ tabId }, '1.3');
    await chrome.debugger.sendCommand({ tabId }, 'Fetch.enable', {
      patterns: [
        { urlPattern: '*', requestStage: 'Response' }
      ]
    });
    activeSessions.add(tabId);
    return null;
  } catch (e) {
    return e.message || 'Error al conectar el debugger. ¿Hay otra herramienta usando el debugger en esta pestaña?';
  }
}

async function stopSession(tabId) {
  if (!activeSessions.has(tabId)) return;
  activeSessions.delete(tabId);
  try {
    await chrome.debugger.sendCommand({ tabId }, 'Fetch.disable', {});
    await chrome.debugger.detach({ tabId });
  } catch (_) { /* ya fue desconectado */ }
}

// ─── CDP event handler ────────────────────────────────────────────────────────

chrome.debugger.onEvent.addListener(async (source, method, params) => {
  if (method !== 'Fetch.requestPaused') return;

  const tabId = source.tabId;
  if (!activeSessions.has(tabId)) return;

  const { requestId, request, responseStatusCode, responseHeaders, resourceType } = params;

  // Only handle the response stage (responseStatusCode is present)
  if (responseStatusCode === undefined) {
    await safeCDP(tabId, 'Fetch.continueRequest', { requestId });
    return;
  }

  // Capture response body
  let resBody = '';
  try {
    const { body, base64Encoded } = await chrome.debugger.sendCommand(
      { tabId },
      'Fetch.getResponseBody',
      { requestId }
    );
    if (base64Encoded) {
      // atob() returns a binary string (Latin-1). Convert to proper UTF-8.
      const bytes = Uint8Array.from(atob(body), (c) => c.charCodeAt(0));
      resBody = new TextDecoder().decode(bytes);
    } else {
      resBody = body || '';
    }
  } catch (_) { /* no body (e.g. 204, redirects) */ }

  const graphql = parseGraphQL(request.postData);
  const rules = await loadRules();
  const matched = matchRule(rules, request.url, request.method, graphql, request.postData || '');

  // Apply matching rule or pass through — do CDP calls FIRST so we know if they succeeded
  let ruleApplied = false;
  const port = panelPorts.get(tabId);

  if (matched?.enabled) {
    const baseHeaders = matched.resHeaders?.length ? matched.resHeaders : responseHeaders;
    console.log(`[RR] MATCH rule="${matched.name || matched.id}" block=${!!matched.blockRequest} url="${request.url}"`);

    let ok = false;
    if (matched.blockRequest) {
      if (matched.blockType === 'network-fail') {
        ok = await safeCDP(tabId, 'Fetch.failRequest', { requestId, errorReason: 'Failed' });
      } else {
        const errorStatus = matched.blockStatus || matched.statusCode || 500;
        const errorBody = matched.resBody || `{"error":"Request bloqueado por Request Recon","status":${errorStatus}}`;
        ok = await safeCDP(tabId, 'Fetch.fulfillRequest', {
          requestId,
          responseCode: errorStatus,
          responseHeaders: stripEncodingHeaders(baseHeaders),
          body: encodeBody(errorBody)
        });
      }
    } else {
      const overrideBody = matched.resBody != null ? matched.resBody : resBody;
      const overrideStatus = matched.statusCode || responseStatusCode;
      ok = await safeCDP(tabId, 'Fetch.fulfillRequest', {
        requestId,
        responseCode: overrideStatus,
        // Strip encoding/length headers: getResponseBody returns the decompressed body,
        // so if we re-send the original Content-Encoding the browser tries to decompress
        // again and the response silently breaks.
        responseHeaders: stripEncodingHeaders(baseHeaders),
        body: encodeBody(overrideBody)
      });
    }

    if (ok) {
      ruleApplied = true;
      console.log(`[RR] applied rule="${matched.name || matched.id}"`);
    } else {
      await safeCDP(tabId, 'Fetch.continueRequest', { requestId });
      if (port) {
        try {
          port.postMessage({ type: 'ERROR', message: `No se pudo aplicar la regla "${matched.name || matched.id}". Revisá la consola del SW (chrome://serviceworker-internals).` });
        } catch (_) {}
      }
    }
  } else {
    console.log(`[RR] no match url="${request.url}" op="${graphql?.operationName ?? '-'}"`);
    await safeCDP(tabId, 'Fetch.continueRequest', { requestId });
  }

  // Notify the panel AFTER CDP calls so ruleApplied reflects actual result
  if (port) {
    try {
      port.postMessage({
        type: 'REQUEST',
        data: {
          id: requestId,
          url: request.url,
          method: request.method,
          resourceType: resourceType || 'Other',
          reqHeaders: request.headers,
          reqBody: request.postData || '',
          resStatus: responseStatusCode,
          resHeaders: responseHeaders || [],
          resBody,
          graphql,
          ruleId: matched?.id ?? null,
          ruleApplied,
          ts: Date.now()
        }
      });
    } catch (_) { /* port closed */ }
  }
});

chrome.debugger.onDetach.addListener((source) => {
  const tabId = source.tabId;
  activeSessions.delete(tabId);
  const port = panelPorts.get(tabId);
  if (port) {
    try { port.postMessage({ type: 'STATUS', active: false, reason: 'detached' }); } catch (_) {}
  }
});

// ─── Helpers ─────────────────────────────────────────────────────────────────

async function safeCDP(tabId, command, params) {
  try {
    await chrome.debugger.sendCommand({ tabId }, command, params);
    return true;
  } catch (e) {
    console.error(`[RR] ${command} failed:`, e.message);
    return false;
  }
}

function encodeBody(str) {
  try {
    const bytes = new TextEncoder().encode(str ?? '');
    let bin = '';
    bytes.forEach((b) => (bin += String.fromCharCode(b)));
    return btoa(bin);
  } catch (_) {
    return btoa('');
  }
}

// CDP headers can arrive as object or [{name,value}] array — normalise to array
function normalizeHeaders(headers) {
  if (!headers) return [];
  if (Array.isArray(headers)) return headers;
  return Object.entries(headers).map(([name, value]) => ({ name, value: String(value) }));
}

// When we fulfillRequest we always provide the raw (decompressed) body,
// so encoding/transfer headers must be removed to avoid double-decompression.
const STRIP_HEADERS = new Set(['content-encoding', 'content-length', 'transfer-encoding']);
function stripEncodingHeaders(headers) {
  return normalizeHeaders(headers).filter((h) => !STRIP_HEADERS.has(h.name.toLowerCase()));
}

function parseGraphQL(postData) {
  if (!postData) return null;
  try {
    const body = JSON.parse(postData);
    if (body && typeof body === 'object' && (body.query !== undefined || body.operationName)) {
      return {
        operationName: body.operationName || null,
        query: body.query || null,
        variables: body.variables || null
      };
    }
  } catch (_) {}
  return null;
}

function matchRule(rules, url, method, graphql, reqBody) {
  return (
    rules.find((r) => {
      if (!r.enabled) return false;

      // URL matching — supports regex patterns
      let urlOk;
      if (r.urlPattern) {
        try {
          urlOk = new RegExp(r.urlPattern, 'i').test(url);
        } catch (_) {
          urlOk = url.includes(r.urlPattern);
        }
      } else {
        urlOk = url === r.url;
      }
      if (!urlOk) return false;

      // Method matching
      if (r.method && r.method !== '*') {
        if (r.method.toUpperCase() !== method.toUpperCase()) return false;
      }

      // GraphQL operation matching
      if (r.operationName) {
        if (!graphql || graphql.operationName !== r.operationName) return false;
      }

      // Request body substring filter — lets rules target specific payloads
      // (e.g. same endpoint with different filter params)
      if (r.bodyContains && r.bodyContains.trim()) {
        const body = typeof reqBody === 'string' ? reqBody : '';
        if (!body.includes(r.bodyContains.trim())) return false;
      }

      return true;
    }) ?? null
  );
}

// ─── Storage ─────────────────────────────────────────────────────────────────

async function loadRules() {
  const { rules = [] } = await chrome.storage.local.get('rules');
  return rules;
}

async function upsertRule(rule) {
  const rules = await loadRules();
  const idx = rules.findIndex((r) => r.id === rule.id);
  const now = new Date().toISOString();

  if (idx >= 0) {
    rules[idx] = { ...rules[idx], ...rule, updatedAt: now };
  } else {
    rules.unshift({ ...rule, id: rule.id || crypto.randomUUID(), createdAt: now, updatedAt: now });
  }

  await chrome.storage.local.set({ rules });
  return rules;
}

async function deleteRule(ruleId) {
  const rules = (await loadRules()).filter((r) => r.id !== ruleId);
  await chrome.storage.local.set({ rules });
  return rules;
}

async function toggleRule(ruleId, enabled) {
  const rules = await loadRules();
  const rule = rules.find((r) => r.id === ruleId);
  if (rule) {
    rule.enabled = enabled;
    rule.updatedAt = new Date().toISOString();
  }
  await chrome.storage.local.set({ rules });
  return rules;
}

async function importRules(incoming) {
  const existing = await loadRules();
  const merged = [...existing];
  const now = new Date().toISOString();

  for (const r of incoming) {
    const idx = merged.findIndex((e) => e.id === r.id);
    if (idx >= 0) {
      merged[idx] = { ...r, updatedAt: now };
    } else {
      merged.unshift({ ...r, id: r.id || crypto.randomUUID(), createdAt: now, updatedAt: now });
    }
  }

  await chrome.storage.local.set({ rules: merged });
  return merged;
}
