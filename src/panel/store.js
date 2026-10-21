import { createMemo, createSignal } from "solid-js";
import { MAX_REQUESTS, getRequestLabel, ruleMatchesRequest } from "../lib/request-utils";

export const [requests, setRequests] = createSignal([]);
export const [rules, setRules] = createSignal([]);
export const [selectedId, setSelectedId] = createSignal(null);
export const [directEditRule, setDirectEditRule] = createSignal(null);
export const [isRecording, setIsRecording] = createSignal(false);
export const [activeTab, setActiveTab] = createSignal("response");
export const [showRulesSidebar, setShowRulesSidebar] = createSignal(false);
export const [filterText, setFilterText] = createSignal("");
export const [methodFilter, setMethodFilter] = createSignal("");
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

export const visibleRequests = createMemo(() => {
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
