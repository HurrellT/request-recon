import { RE2JS } from "re2js";
import { MAX_PATTERN_LENGTH, MAX_URL_LENGTH } from "./limits.js";

const patterns = new Map();

export function compilePattern(pattern) {
  if (typeof pattern !== "string" || !pattern || pattern.length > MAX_PATTERN_LENGTH) {
    throw new Error("URL pattern must contain 1–2048 characters");
  }
  if (!patterns.has(pattern)) {
    const compiled = RE2JS.compile(pattern, RE2JS.CASE_INSENSITIVE);
    if (patterns.size >= 500) patterns.delete(patterns.keys().next().value);
    patterns.set(pattern, compiled);
  }
  return patterns.get(pattern);
}

export function ruleMatchesURL(rule, url) {
  if (typeof url !== "string" || url.length > MAX_URL_LENGTH) return false;
  try {
    if (rule.urlPattern) return compilePattern(rule.urlPattern).matcher(url).find();
    return !!rule.url && url === rule.url;
  } catch (_) {
    return false;
  }
}

export function ruleMatchesRequest(rule, request) {
  if (!rule || !request || !ruleMatchesURL(rule, request.url)) return false;
  if (rule.method && rule.method !== "*" && rule.method.toUpperCase() !== request.method?.toUpperCase()) return false;
  if (rule.operationName && rule.operationName !== request.graphql?.operationName) return false;
  if (rule.bodyContains?.trim() && !request.reqBody?.includes(rule.bodyContains.trim())) return false;
  return true;
}

export const findActiveRule = (rules, request) => rules.find((rule) => rule.enabled && ruleMatchesRequest(rule, request)) ?? null;
