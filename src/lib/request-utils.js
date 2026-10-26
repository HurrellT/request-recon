export { MAX_REQUESTS } from "./limits.js";
export { ruleMatchesRequest } from "./rule-matcher.js";
export const HTTP_METHODS = ["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS"];

export function methodCSSClass(method) {
  const m = (method || "").toUpperCase();
  const map = {
    GET: "method-get",
    POST: "method-post",
    PUT: "method-put",
    PATCH: "method-patch",
    DELETE: "method-delete",
  };
  return map[m] || "method-other";
}

export function statusDotClass(code) {
  if (!code) return "pending";
  if (code >= 400) return "error";
  if (code >= 300) return "redir";
  return "ok";
}

export function statusBadgeClass(code) {
  if (code >= 400) return "error";
  if (code >= 300) return "redir";
  return "ok";
}

export function getResponseOutcome(req) {
  if (req?.networkFailureApplied || (req?.responseErrorReason && !req?.ruleApplied)) return { status: null, networkFailure: true };
  return { status: req?.appliedStatus ?? req?.resStatus ?? null, networkFailure: false };
}

export function requestRuleState(req, matchedRule) {
  const active = !!matchedRule?.enabled;
  const applied = req.ruleApplied === true || (req.ruleApplied == null && !!req.ruleId && active);
  if (applied) return (req.appliedBlockRequest ?? matchedRule?.blockRequest) ? "blocked" : "intercepted";
  return active ? "pending" : null;
}

export function getRequestLabel(req) {
  return req.graphql?.operationName || getPath(req.url);
}

export function getPath(url) {
  try {
    const parsed = new URL(url);
    return parsed.pathname + (parsed.search ? parsed.search.substring(0, 20) : "");
  } catch (_) {
    return String(url || "").substring(0, 60);
  }
}

export function urlToPattern(url) {
  try {
    const parsed = new URL(url);
    return `^${escapeRegex(parsed.origin)}${escapeRegex(parsed.pathname)}(?:[?]|$)`;
  } catch (_) {
    return escapeRegex(url || "");
  }
}

export function escapeRegex(value) {
  return String(value || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function prettyJSON(value) {
  if (!value) return "";
  const formatted = tryFormatJSON(value);
  return formatted !== null ? formatted : value;
}

export function tryFormatJSON(value) {
  try {
    return JSON.stringify(JSON.parse(value), null, 2);
  } catch (_) {
    return null;
  }
}

export function truncate(value, max) {
  const text = String(value || "");
  return text.length > max ? `${text.substring(0, max)}...` : text;
}

export function shortPattern(pattern) {
  if (!pattern) return "";
  try {
    const cleaned = pattern.replace(/\\([.*+?^${}()|[\]\\])/g, "$1");
    const url = new URL(cleaned);
    return url.host + url.pathname;
  } catch (_) {
    return truncate(pattern, 36);
  }
}

export function getBodySummary(req) {
  if (!req.reqBody || !req.reqBody.trim()) return null;
  try {
    const body = JSON.parse(req.reqBody);
    if (typeof body !== "object" || Array.isArray(body)) return null;
    const skipped = new Set(["page", "pageSize", "limit", "offset", "size", "per_page", "pageNumber"]);
    const entries = Object.entries(body).filter(([key]) => !skipped.has(key)).slice(0, 3);
    if (!entries.length) return null;
    return entries
      .map(([key, value]) => {
        const text = typeof value === "object" ? JSON.stringify(value) : String(value);
        return `${key}: ${text.length > 20 ? `${text.slice(0, 20)}...` : text}`;
      })
      .join(" | ");
  } catch (_) {
    const text = req.reqBody.trim();
    return text.length > 60 ? `${text.slice(0, 60)}...` : text;
  }
}

export function suggestBodyFilter(req) {
  if (!req?.reqBody || req.graphql) return "";
  try {
    const body = JSON.parse(req.reqBody);
    if (typeof body !== "object" || Array.isArray(body)) return "";
    const skipped = new Set(["page", "pageSize", "limit", "offset", "size", "per_page"]);
    const entry = Object.entries(body).find(([key]) => !skipped.has(key));
    if (!entry) return "";
    const [key, value] = entry;
    if (typeof value === "object") return `"${key}":`;
    return `"${key}":${JSON.stringify(value)}`;
  } catch (_) {
    return "";
  }
}

export function headersToEntries(headers) {
  if (!headers) return [];
  if (Array.isArray(headers)) return headers.map((header) => [header.name, header.value]);
  if (typeof headers === "object") return Object.entries(headers);
  return [];
}
