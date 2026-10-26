import { compilePattern } from "./rule-matcher.js";
import { byteLength, MAX_RULES, MAX_RULE_BODY_BYTES, MAX_RULE_FILE_BYTES, MAX_URL_LENGTH } from "./limits.js";

export function validateRule(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Invalid rule");
  const rule = {};
  for (const [key, limit] of Object.entries({ id: 128, name: 256, urlPattern: 2048, url: MAX_URL_LENGTH, method: 32, operationName: 256, bodyContains: 4096, createdAt: 64, updatedAt: 64 })) {
    if (value[key] == null) continue;
    if (typeof value[key] !== "string" || value[key].length > limit) throw new Error(`Invalid ${key}`);
    rule[key] = value[key];
  }
  if (!rule.urlPattern?.trim() && !rule.url) throw new Error("A URL or URL pattern is required");
  if (rule.urlPattern) compilePattern(rule.urlPattern);
  if (rule.url) {
    const url = new URL(rule.url);
    if (!["http:", "https:"].includes(url.protocol)) throw new Error("Use an HTTP(S) URL");
  }
  if (rule.method && rule.method !== "*" && !/^[A-Za-z]+$/.test(rule.method)) throw new Error("Invalid method");
  if (rule.method) rule.method = rule.method.toUpperCase();
  for (const key of ["enabled", "blockRequest"]) {
    if (value[key] != null && typeof value[key] !== "boolean") throw new Error(`Invalid ${key}`);
    rule[key] = value[key] ?? false;
  }
  for (const key of ["statusCode", "blockStatus"]) {
    if (value[key] == null) continue;
    if (!Number.isInteger(value[key]) || value[key] < 200 || value[key] > 599) throw new Error(`Invalid ${key}: use 200–599`);
    rule[key] = value[key];
  }
  if (value.blockType != null && !["http-error", "network-fail"].includes(value.blockType)) throw new Error("Invalid error type");
  rule.blockType = value.blockType ?? "http-error";
  if (value.resBody != null) {
    if (typeof value.resBody !== "string" || byteLength(value.resBody) > MAX_RULE_BODY_BYTES) throw new Error("Response body exceeds 1 MiB or is not text");
    rule.resBody = value.resBody;
  } else if (value.resBody === null) rule.resBody = null;
  if (value.resHeaders != null) {
    if (!Array.isArray(value.resHeaders) || value.resHeaders.length > 100) throw new Error("Invalid response headers");
    rule.resHeaders = value.resHeaders.map((header) => {
      if (!header || typeof header.name !== "string" || !/^[!#$%&'*+.^_`|~0-9A-Za-z-]{1,256}$/.test(header.name) || typeof header.value !== "string" || header.value.length > 16384 || /[\r\n\0]/.test(header.value)) throw new Error("Invalid response header");
      return { name: header.name, value: header.value };
    });
  } else if (value.resHeaders === null) rule.resHeaders = null;
  return rule;
}

export function validateRules(rules) {
  if (!Array.isArray(rules) || rules.length > MAX_RULES) throw new Error("Use at most 500 rules");
  const normalized = rules.map(validateRule);
  if (byteLength(exportRules(normalized)) > MAX_RULE_FILE_BYTES) throw new Error("Rules exceed 8 MiB");
  const ids = normalized.map((rule) => rule.id).filter(Boolean);
  if (new Set(ids).size !== ids.length) throw new Error("Duplicate rule IDs");
  return normalized;
}

export function parseRulesFile(contents) {
  if (byteLength(contents) > MAX_RULE_FILE_BYTES) throw new Error("Rules file exceeds 8 MiB");
  const parsed = JSON.parse(contents);
  if (parsed?.format === "request-recon-rules") {
    if (parsed.version !== 1) throw new Error("Unsupported rules file version");
    return validateRules(parsed.rules);
  }
  return validateRules(Array.isArray(parsed) ? parsed : [parsed]);
}

export const exportRules = (rules) => JSON.stringify({ format: "request-recon-rules", version: 1, rules }, null, 2);
