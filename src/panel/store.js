import { createMemo, createSignal } from "solid-js";
import { MAX_REQUESTS, getRequestLabel, requestRuleState, ruleMatchesRequest } from "../lib/request-utils";
import { DEFAULT_TRAFFIC_VISIBILITY, TRAFFIC_CATEGORIES, getTrafficCategory, isHiddenByTrafficFilter } from "../lib/traffic-filter";

export const [requests, setRequests] = createSignal([]);
export const [rules, setRules] = createSignal([]);
export const [selectedId, setSelectedId] = createSignal(null);
export const [directEditRule, setDirectEditRule] = createSignal(null);
export const [isRecording, setIsRecording] = createSignal(false);
export const [activeTab, setActiveTab] = createSignal("response");
export const [showRulesSidebar, setShowRulesSidebar] = createSignal(false);
export const [filterText, setFilterText] = createSignal("");
export const [methodFilter, setMethodFilter] = createSignal("");
export const [trafficVisibility, setTrafficVisibility] = createSignal({ ...DEFAULT_TRAFFIC_VISIBILITY });
export const [toast, setToast] = createSignal(null);

let port = null;
let toastTimer = null;

export function setPort(nextPort) {
  port = nextPort;
}

export function send(msg) {
  port?.postMessage(msg);
}

export function addRequest(req) {
  setRequests((prev) => {
    const next = prev.length >= MAX_REQUESTS ? prev.slice(1) : prev.slice();
    const idx = next.findIndex((item) => item.id === req.id);
    if (idx >= 0) next[idx] = req;
    else next.push(req);
    return next;
  });
}

export const selectedRequest = createMemo(() => {
  const id = selectedId();
  return requests().find((req) => req.id === id) ?? null;
});

export function findRule(ruleId) {
  return rules().find((rule) => rule.id === ruleId) ?? null;
}

export function findMatchingRuleForRequest(req) {
  if (!req) return null;
  return rules().find((rule) => ruleMatchesRequest(rule, req)) ?? null;
}

export function ruleStateForRequest(req) {
  if (!req) return null;
  const matchedRule = (req.ruleId ? findRule(req.ruleId) : null) ?? findMatchingRuleForRequest(req);
  return requestRuleState(req, matchedRule);
}

export function applyTrafficVisibility(value) {
  setTrafficVisibility({
    ...DEFAULT_TRAFFIC_VISIBILITY,
    ...Object.fromEntries(TRAFFIC_CATEGORIES.map((category) => [category, value?.[category] === true])),
  });
}

export function updateTrafficVisibility(category, show) {
  if (!TRAFFIC_CATEGORIES.includes(category)) return;
  const next = { ...trafficVisibility(), [category]: show };
  setTrafficVisibility(next);
  chrome.storage.local.set({ trafficVisibility: next });
}

export function setAllTrafficVisible(show) {
  const next = Object.fromEntries(TRAFFIC_CATEGORIES.map((category) => [category, show]));
  setTrafficVisibility(next);
  chrome.storage.local.set({ trafficVisibility: next });
}

export const matchingRequests = createMemo(() => {
  const filter = filterText().toLowerCase().trim();
  const method = methodFilter();
  let visible = requests().slice().reverse();

  if (filter) {
    visible = visible.filter((req) => {
      const label = getRequestLabel(req).toLowerCase();
      return req.url.toLowerCase().includes(filter) || label.includes(filter);
    });
  }

  if (method) {
    visible = visible.filter((req) => req.method === method);
  }

  return visible;
});

export const hiddenCategoryCounts = createMemo(() => {
  const counts = { preflight: 0, assets: 0, navigation: 0 };
  const visibility = trafficVisibility();
  for (const req of matchingRequests()) {
    if (!isHiddenByTrafficFilter(req, visibility)) continue;
    counts[getTrafficCategory(req)]++;
  }
  return counts;
});

export const hiddenRequestCount = createMemo(() => Object.values(hiddenCategoryCounts()).reduce((total, count) => total + count, 0));

export const visibleRequests = createMemo(() => matchingRequests().filter((req) => !isHiddenByTrafficFilter(req, trafficVisibility())));

export function clearRequests() {
  setRequests([]);
  setSelectedId(null);
  setDirectEditRule(null);
}

export function showToast(message, type = "") {
  setToast({ message, type });
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => setToast(null), 2500);
}

export function downloadJSON(data, filename) {
  const blob = new Blob([data], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}
