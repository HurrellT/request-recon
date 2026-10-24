import { getPath, prettyJSON, suggestBodyFilter, urlToPattern } from "../../lib/request-utils.js";

export function initialRuleDraft(rule, request) {
  return {
    name: rule?.name ?? request?.graphql?.operationName ?? getPath(request?.url ?? ""),
    urlPattern: rule?.urlPattern ?? (request ? urlToPattern(request.url) : ""),
    method: rule?.method ?? request?.method ?? "*",
    operationName: rule?.operationName ?? request?.graphql?.operationName ?? "",
    bodyContains: rule?.bodyContains ?? suggestBodyFilter(request),
    statusCode: rule?.statusCode ?? request?.resStatus ?? 200,
    responseBody: prettyJSON(rule?.resBody ?? request?.resBody ?? ""),
    enabled: rule?.enabled ?? true,
    blockRequest: rule?.blockRequest ?? false,
    blockType: rule?.blockType ?? "http-error",
    blockStatus: rule?.blockStatus ?? 500,
  };
}

export function ruleFromDraft(draft, ruleId, request) {
  const operationName = draft.operationName.trim() || null;
  const blockStatus = parseInt(draft.blockStatus, 10);
  const isHttpBlock = draft.blockRequest && draft.blockType !== "network-fail";

  return {
    id: ruleId || crypto.randomUUID(),
    name: draft.name.trim() || operationName || request?.graphql?.operationName || getPath(draft.urlPattern) || draft.urlPattern,
    urlPattern: draft.urlPattern.trim(),
    method: draft.method,
    operationName,
    bodyContains: draft.bodyContains.trim() || null,
    resBody: draft.responseBody,
    statusCode: isHttpBlock ? blockStatus : parseInt(draft.statusCode, 10) || 200,
    enabled: ruleId ? draft.enabled : true,
    resHeaders: null,
    blockRequest: draft.blockRequest,
    blockType: draft.blockType,
    blockStatus,
  };
}
