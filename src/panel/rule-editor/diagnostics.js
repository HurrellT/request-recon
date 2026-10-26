import { ruleMatchesRequest, ruleMatchesURL } from "../../lib/rule-matcher.js";

export function buildRuleDiagnostics(rule, capturedRequests, translate) {
  if (!rule || capturedRequests.length === 0) return null;
  const matchCount = capturedRequests.filter((request) => ruleMatchesRequest(rule, request)).length;
  const candidate = [...capturedRequests].reverse().find((request) => {
    return ruleMatchesURL(rule, request.url);
  });

  if (matchCount > 0) {
    return {
      summary: translate("diagnosticsMatched", { count: matchCount }),
      hint: translate("diagnosticsMatchedHint", { count: matchCount }),
      rows: [],
      open: false,
    };
  }

  const rows = [];
  const urlOk = (() => {
    return ruleMatchesURL(rule, candidate?.url ?? "");
  })();
  rows.push({ ok: urlOk, label: translate("urlPattern"), value: rule.urlPattern || rule.url || translate("any") });

  const methodOk = !rule.method || rule.method === "*" || (candidate && rule.method.toUpperCase() === candidate.method.toUpperCase());
  rows.push({ ok: methodOk, label: translate("method"), value: rule.method || "*", actual: candidate ? translate("requestMethodActual", { method: candidate.method }) : "" });

  if (rule.operationName) {
    const opOk = candidate && candidate.graphql?.operationName === rule.operationName;
    rows.push({ ok: opOk, label: translate("graphqlOperation"), value: rule.operationName, actual: candidate ? translate("requestOperationActual", { operation: candidate.graphql?.operationName ?? "-" }) : "" });
  }

  if (rule.bodyContains?.trim()) {
    const bodyOk = candidate && candidate.reqBody?.includes(rule.bodyContains.trim());
    rows.push({ ok: bodyOk, label: translate("bodyContainsShort"), value: rule.bodyContains });
  }

  return {
    summary: translate("diagnosticsNone", { count: capturedRequests.length }),
    hint: !candidate ? translate("noCapturedCompare") : translate("comparingLatest"),
    rows,
    open: true,
  };
}
