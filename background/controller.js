import { createRuleRepository } from "./rule-repository.js";
import { exportRules } from "../src/lib/rules.js";
import { findActiveRule } from "../src/lib/rule-matcher.js";
import { capturedRequest, normalizeHeaders, captureHeaders, encodeBody, stripEncodingHeaders, bodySkipReason, decodeCapturedBody } from "../src/lib/capture.js";
import { MAX_CAPTURE_BODY_BYTES, MAX_CAPTURE_BYTES, MAX_REQUESTS, requestBytes } from "../src/lib/limits.js";
import { normalizeLanguage, translate } from "../src/lib/translations.js";

export function createRequestRecon(chrome, timers = globalThis) {
  const repository = createRuleRepository(chrome.storage.local, chrome.storage.onChanged);
  const sessions = new Map();
  const ports = new Map();
  const disconnectTimers = new Map();
  const lifecycle = new Map();
  const post = (port, message) => { try { port?.postMessage(message); } catch (_) {} };
  const notify = (tabId, data) => post(ports.get(tabId), { type: "REQUEST", data });
  const command = (target, method, params = {}) => chrome.debugger.sendCommand(target, method, params);
  const status = (tabId) => post(ports.get(tabId), { type: "STATUS", active: !!sessions.get(tabId)?.active });

  function serialize(tabId, action) {
    const task = (lifecycle.get(tabId) || Promise.resolve()).then(action);
    const tail = task.catch(() => {});
    lifecycle.set(tabId, tail);
    tail.then(() => { if (lifecycle.get(tabId) === tail) lifecycle.delete(tabId); });
    return task;
  }

  async function teardown(tabId) {
    const session = sessions.get(tabId);
    if (!session) return;
    session.active = false;
    // No Fetch body reads are ever pending; disabling interception is safe.
    let disabled = false;
    try { await command({ tabId }, "Fetch.disable"); disabled = true; } catch (_) {}
    try {
      await chrome.debugger.detach({ tabId });
      if (sessions.get(tabId) === session) sessions.delete(tabId);
    } catch (error) {
      // Keep late pauses recoverable and retain the session for another Stop.
      session.cleanupFailed = true;
      throw new Error(disabled ? `Capture stopped, but debugger cleanup failed: ${error.message}` : `Could not stop the debugger: ${error.message}`);
    } finally { session.requests.clear(); session.pendingBytes = 0; status(tabId); }
  }

  const stopSession = (tabId) => serialize(tabId, () => teardown(tabId));
  const startSession = (tabId) => serialize(tabId, async () => {
    if (sessions.get(tabId)?.active) return;
    if (sessions.has(tabId)) await teardown(tabId);
    await repository.load();
    const session = { active: false, requests: new Map(), interceptions: new Map(), pendingBytes: 0 };
    let attached = false;
    try {
      await chrome.debugger.attach({ tabId }, "1.3");
      attached = true;
      sessions.set(tabId, session);
      await command({ tabId }, "Network.enable", {
        maxTotalBufferSize: 8 * 1024 * 1024,
        maxResourceBufferSize: MAX_CAPTURE_BODY_BYTES,
        maxPostDataSize: 64 * 1024,
      });
      await command({ tabId }, "Fetch.enable", { patterns: [{ urlPattern: "*", requestStage: "Response" }] });
      if (sessions.get(tabId) !== session) throw new Error("Debugger detached during setup");
      session.active = true;
      status(tabId);
    } catch (error) {
      if (attached && sessions.get(tabId) === session) {
        try { await teardown(tabId); } catch (_) { /* retained for cleanup retry */ }
      }
      throw error;
    }
  });

  async function handleCommand(message) {
    const tabId = message.tabId;
    switch (message.type) {
      case "START":
      case "STOP":
        if (!Number.isInteger(tabId) || tabId < 0) throw new Error("Invalid tab ID");
        await (message.type === "START" ? startSession(tabId) : stopSession(tabId));
        return { active: !!sessions.get(tabId)?.active };
      case "STOP_ALL":
        await Promise.all([...sessions.keys()].map(stopSession));
        return { activeSessions: [] };
      case "GET_RULES":
        return { rules: await repository.load(), invalidCount: repository.invalidCount, activeSessions: [...sessions.keys()] };
      case "SAVE_RULE": return { rules: await repository.save(message.rule) };
      case "DELETE_RULE": return { rules: await repository.remove(message.ruleId) };
      case "TOGGLE_RULE": return { rules: await repository.toggle(message.ruleId, message.enabled) };
      case "TOGGLE_ALL": return { rules: await repository.toggleAll(message.enabled) };
      case "IMPORT_RULES": return { rules: await repository.import(message.rules) };
      case "EXPORT_RULES": return { data: exportRules(await repository.load()) };
      case "KEEPALIVE": return {};
      default: throw new Error("Unknown command");
    }
  }

  async function respond(message) {
    try { return { type: "RESULT", commandId: message.commandId, ok: true, ...await handleCommand(message) }; }
    catch (error) { return { type: "RESULT", commandId: message.commandId, ok: false, errorKey: message.type === "START" ? "debuggerConnectFailed" : "commandFailed", params: { details: error.message || "" } }; }
  }

  const onConnect = (port) => {
    const match = /^panel-(\d+)$/.exec(port.name);
    if (!match || (port.sender?.id && port.sender.id !== chrome.runtime.id)) return;
    const tabId = Number(match[1]);
    timers.clearTimeout(disconnectTimers.get(tabId));
    disconnectTimers.delete(tabId);
    ports.set(tabId, port);
    status(tabId);
    repository.load().then((rules) => {
      post(port, { type: "RULES", rules });
      if (repository.invalidCount) post(port, { type: "ERROR", errorKey: "invalidStoredRules", params: { count: repository.invalidCount } });
    }).catch(() => post(port, { type: "ERROR", errorKey: "rulesSaveFailed" }));
    port.onMessage.addListener((message) => { respond({ ...message, tabId }).then((reply) => post(port, reply)); });
    port.onDisconnect.addListener(() => {
      if (ports.get(tabId) !== port) return;
      ports.delete(tabId);
      const timer = timers.setTimeout(() => {
        disconnectTimers.delete(tabId);
        if (!ports.has(tabId)) stopSession(tabId).catch(() => {});
      }, 2000);
      disconnectTimers.set(tabId, timer);
    });
  };
  const onMessage = (message, sender, sendResponse) => {
    if (sender.id !== chrome.runtime.id) return false;
    respond(message).then(sendResponse);
    return true;
  };

  function removeRequest(session, id) {
    const request = session.requests.get(id);
    if (!request) return;
    session.pendingBytes -= request.retainedBytes || 0;
    session.requests.delete(id);
  }
  function remember(session, request) {
    removeRequest(session, request.id);
    request.retainedBytes = requestBytes(request);
    session.requests.set(request.id, request);
    session.pendingBytes += request.retainedBytes;
    while (session.requests.size > MAX_REQUESTS || session.pendingBytes > MAX_CAPTURE_BYTES) removeRequest(session, session.requests.keys().next().value);
  }
  function publish(tabId, request) {
    const { retainedBytes, bodyBytes, displayId, networkId, ...data } = request;
    notify(tabId, { ...data, id: displayId || data.id });
  }

  async function handlePaused(source, params) {
    const tabId = source.tabId;
    let released = false;
    let matched;
    let finishInterception;
    let session;
    try {
      session = sessions.get(tabId);
      if (!session?.active) return;
      if (params.responseStatusCode === undefined && params.responseErrorReason === undefined) return;
      if (params.networkId) session.interceptions.set(params.networkId, new Promise((resolve) => { finishInterception = resolve; }));
      const req = capturedRequest(params.networkId || params.requestId, params.request, params.resourceType);
      req.resStatus = params.responseStatusCode ?? null;
      req.responseErrorReason = params.responseErrorReason || null;
      req.resHeaders = captureHeaders(params.responseHeaders);
      matched = findActiveRule(await repository.load(), { ...req, url: params.request.url });
      if (!matched || !session.active) return;
      const responseCode = matched.blockRequest ? (matched.blockStatus || matched.statusCode || 500) : (matched.statusCode || params.responseStatusCode || 200);
      const headers = matched.resHeaders?.length ? matched.resHeaders : params.responseHeaders;
      let body = matched.resBody;
      if (matched.blockRequest && matched.blockType === "network-fail") {
        await command(source, "Fetch.failRequest", { requestId: params.requestId, errorReason: "Failed" });
        req.networkFailureApplied = true;
      } else {
        if (matched.blockRequest && body === undefined) {
          let language = normalizeLanguage(chrome.i18n.getUILanguage());
          try { language = normalizeLanguage((await chrome.storage.local.get("language")).language || language); } catch (_) {}
          body = JSON.stringify({ error: translate(language, "blockedRequest"), status: responseCode });
        }
        if (body == null && params.responseErrorReason) throw new Error("An upstream network failure requires an explicit replacement body");
        // Omit body to preserve the original bytes for status/header-only rules.
        await command(source, "Fetch.fulfillRequest", {
          requestId: params.requestId,
          responseCode,
          responseHeaders: body == null ? normalizeHeaders(headers) : stripEncodingHeaders(headers),
          ...(body == null ? {} : { body: encodeBody(body) }),
        });
        req.appliedStatus = responseCode;
      }
      released = true;
      req.ruleId = matched.id;
      req.ruleApplied = true;
      req.appliedBlockRequest = !!matched.blockRequest;
      req.bodyUnavailable = "overridden";
      // Network sees the synthetic body; it is not the captured upstream body.
      let captured = req;
      if (params.networkId) {
        const pending = session.requests.get(params.networkId);
        captured = { ...pending, ...req };
        remember(session, captured);
      }
      publish(tabId, captured);
    } catch (error) {
      post(ports.get(tabId), { type: "ERROR", errorKey: matched ? "applyRuleFailed" : "commandFailed", params: { name: matched?.name || matched?.id, details: error.message } });
    } finally {
      if (!released) {
        try { await command(source, "Fetch.continueRequest", { requestId: params.requestId }); }
        catch (_) { await stopSession(tabId).catch(() => {}); }
      }
      finishInterception?.();
      if (finishInterception) session.interceptions.delete(params.networkId);
    }
  }

  async function handleNetwork(source, method, params) {
    const tabId = source.tabId;
    const session = sessions.get(tabId);
    if (!session?.active) return;
    if (method === "Network.requestWillBeSent") {
      const previous = session.requests.get(params.requestId);
      if (previous && params.redirectResponse && !previous.ruleApplied) {
        publish(tabId, { ...previous, resStatus: params.redirectResponse.status, resHeaders: captureHeaders(params.redirectResponse.headers), bodyUnavailable: "empty" });
      }
      const req = capturedRequest(params.requestId, params.request, params.type);
      // Redirect hops share a Network ID; give each a distinct UI ID.
      req.displayId = params.redirectResponse ? `${params.requestId}:${params.timestamp}` : params.requestId;
      remember(session, { ...req, bodyBytes: 0 });
      return;
    }
    if (method === "Network.loadingFinished" || method === "Network.loadingFailed") await session.interceptions.get(params.requestId);
    const req = session.requests.get(params.requestId);
    if (!req) return;
    if (method === "Network.responseReceived" && !req.ruleApplied) {
      req.resStatus = params.response.status;
      req.resHeaders = captureHeaders(params.response.headers);
      req.resourceType = params.type || req.resourceType;
      req.bodyUnavailable = bodySkipReason(req);
      if (req.bodyUnavailable === "stream") publish(tabId, req);
      remember(session, req);
    } else if (method === "Network.dataReceived") {
      req.bodyBytes = (req.bodyBytes || 0) + params.dataLength;
    } else if (method === "Network.loadingFinished" || method === "Network.loadingFailed") {
      removeRequest(session, params.requestId);
      if (req.ruleApplied) return;
      if (method === "Network.loadingFailed") {
        req.responseErrorReason = params.errorText || "Failed";
        req.bodyUnavailable = "failed";
      } else {
        req.bodyUnavailable = bodySkipReason(req);
        if (!req.bodyUnavailable) {
          try { Object.assign(req, decodeCapturedBody(await command(source, "Network.getResponseBody", { requestId: params.requestId }), req.resHeaders)); }
          catch (_) { req.bodyUnavailable = "unavailable"; }
        }
      }
      if (session.active) publish(tabId, req);
    }
  }

  const onEvent = (source, method, params) => {
    const task = method === "Fetch.requestPaused" ? handlePaused(source, params) : handleNetwork(source, method, params);
    task.catch(() => post(ports.get(source.tabId), { type: "ERROR", errorKey: "captureFailed" }));
    return task;
  };
  const onDetach = (source) => {
    const session = sessions.get(source.tabId);
    if (session) {
      session.active = false;
      session.requests.clear();
      session.pendingBytes = 0;
    }
    sessions.delete(source.tabId);
    status(source.tabId);
  };
  chrome.runtime.onConnect.addListener(onConnect);
  chrome.runtime.onMessage.addListener(onMessage);
  chrome.debugger.onEvent.addListener(onEvent);
  chrome.debugger.onDetach.addListener(onDetach);
  return {
    respond, onEvent, startSession, stopSession, repository,
    dispose() {
      repository.dispose();
      chrome.runtime.onConnect.removeListener(onConnect);
      chrome.runtime.onMessage.removeListener(onMessage);
      chrome.debugger.onEvent.removeListener(onEvent);
      chrome.debugger.onDetach.removeListener(onDetach);
      for (const timer of disconnectTimers.values()) timers.clearTimeout(timer);
    },
  };
}
