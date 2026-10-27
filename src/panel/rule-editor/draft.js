import { getPath, prettyJSON, suggestBodyFilter, urlToPattern } from "../../lib/request-utils.js";
import { validateRule } from "../../lib/rules.js";
import { validateGeneratedResponse } from "../../lib/llm.js";

export function initialRuleDraft(rule, request) {
  return {
    name: rule?.name ?? request?.graphql?.operationName ?? getPath(request?.url ?? ""),
    urlPattern: rule?.urlPattern ?? (rule?.url ? "" : request ? urlToPattern(request.url) : ""),
    url: rule?.url ?? "",
    method: rule ? rule.method ?? "*" : request?.method ?? "*",
    operationName: rule ? rule.operationName ?? "" : request?.graphql?.operationName ?? "",
    bodyContains: rule ? rule.bodyContains ?? "" : suggestBodyFilter(request),
    statusCode: rule ? rule.statusCode ?? "" : request?.resStatus ?? 200,
    responseBody: prettyJSON(rule?.resBody ?? (rule ? "" : request?.resBody ?? "")),
    overrideBody: rule ? rule.resBody != null : !!request && !request.bodyUnavailable,
    resHeaders: rule?.resHeaders ?? null,
    enabled: rule?.enabled ?? true,
    blockRequest: rule?.blockRequest ?? false,
    blockType: rule?.blockType ?? "http-error",
    blockStatus: rule?.blockStatus ?? 500,
  };
}

export function ruleFromDraft(draft, ruleId, request) {
  const operationName = draft.operationName.trim() || null;
  const blockStatus = Number(draft.blockStatus);
  const isHttpBlock = draft.blockRequest && draft.blockType !== "network-fail";

  return validateRule({
    id: ruleId || crypto.randomUUID(),
    name: draft.name.trim() || operationName || request?.graphql?.operationName || getPath(draft.urlPattern) || draft.urlPattern,
    urlPattern: draft.urlPattern.trim(),
    ...(draft.url && !draft.urlPattern.trim() ? { url: draft.url } : {}),
    method: draft.method,
    operationName,
    bodyContains: draft.bodyContains.trim() || null,
    resBody: draft.overrideBody ? draft.responseBody : null,
    statusCode: isHttpBlock ? blockStatus : String(draft.statusCode).trim() ? Number(draft.statusCode) : undefined,
    enabled: ruleId ? draft.enabled : true,
    resHeaders: draft.resHeaders,
    blockRequest: draft.blockRequest,
    blockType: draft.blockType,
    blockStatus,
  });
}

export function draftFromGeneration(request, value) {
  const generated = validateGeneratedResponse(value);
  return {
    ...initialRuleDraft(null, request),
    name: generated.name,
    statusCode: generated.statusCode,
    responseBody: generated.body,
    overrideBody: true,
  };
}
