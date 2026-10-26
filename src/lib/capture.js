import { MAX_CAPTURE_BODY_BYTES, MAX_REQUEST_BODY_BYTES, MAX_URL_LENGTH, truncateText } from "./limits.js";

export function normalizeHeaders(headers) {
  const entries = Array.isArray(headers) ? headers : Object.entries(headers || {}).map(([name, value]) => ({ name, value: String(value) }));
  return entries.filter((h) => typeof h?.name === "string" && typeof h.value === "string");
}

export const headerValue = (headers, name) => normalizeHeaders(headers).find((h) => h.name.toLowerCase() === name)?.value || "";
export const captureHeaders = (headers) => normalizeHeaders(headers).slice(0, 100).map((h) => ({ name: h.name.slice(0, 256), value: truncateText(h.value, 4096) }));
export const stripEncodingHeaders = (headers) => normalizeHeaders(headers).filter((h) => !["content-encoding", "content-length", "transfer-encoding"].includes(h.name.toLowerCase()));

export function encodeBody(text) {
  const bytes = new TextEncoder().encode(text);
  let binary = "";
  for (let offset = 0; offset < bytes.length; offset += 8192) binary += String.fromCharCode(...bytes.subarray(offset, offset + 8192));
  return btoa(binary);
}

export function parseGraphQL(postData) {
  if (!postData || postData.length > MAX_REQUEST_BODY_BYTES) return null;
  try {
    const body = JSON.parse(postData);
    if (body && !Array.isArray(body) && (typeof body.query === "string" || typeof body.operationName === "string")) {
      return { operationName: typeof body.operationName === "string" ? body.operationName : null, query: typeof body.query === "string" ? body.query : null, variables: body.variables ?? null };
    }
  } catch (_) {}
  return null;
}

export function capturedRequest(requestId, request, type = "Other") {
  const reqBody = truncateText(request.postData || "", MAX_REQUEST_BODY_BYTES);
  const headers = captureHeaders(request.headers);
  return { id: requestId, url: (request.url || "").slice(0, MAX_URL_LENGTH), method: request.method || "GET", resourceType: type, reqHeaders: headers, reqBody, reqBodyTruncated: reqBody !== (request.postData || ""), graphql: parseGraphQL(reqBody), resHeaders: [], resStatus: null, resBody: "", ruleApplied: false, ruleId: null, ts: Date.now() };
}

export function bodySkipReason(request) {
  if (request.responseErrorReason) return "failed";
  if (request.bodyBytes > MAX_CAPTURE_BODY_BYTES || Number(headerValue(request.resHeaders, "content-length")) > MAX_CAPTURE_BODY_BYTES) return "large";
  const type = headerValue(request.resHeaders, "content-type").toLowerCase();
  if (type.includes("text/event-stream")) return "stream";
  if (["Image", "Media", "Font"].includes(request.resourceType) || (type && !/^(text\/|application\/(?:.*\+)?(?:json|xml)|application\/(?:javascript|x-javascript|graphql|x-www-form-urlencoded))/.test(type))) return "binary";
  if (request.method === "HEAD" || [204, 304].includes(request.resStatus) || (request.resStatus >= 300 && request.resStatus < 400)) return "empty";
  return null;
}

export function decodeCapturedBody(result, headers) {
  if (result.base64Encoded) {
    if (result.body.length > Math.ceil(MAX_CAPTURE_BODY_BYTES / 3) * 4) return { resBody: "", bodyUnavailable: "large" };
    const bytes = Uint8Array.from(atob(result.body), (c) => c.charCodeAt(0));
    const charset = headerValue(headers, "content-type").match(/charset\s*=\s*["']?([^\s;"']+)/i)?.[1] || "utf-8";
    try {
      const decoded = new TextDecoder(charset, { fatal: true }).decode(bytes);
      const resBody = truncateText(decoded, MAX_CAPTURE_BODY_BYTES);
      return { resBody, bodyUnavailable: resBody !== decoded ? "large" : null };
    }
    catch (_) { return { resBody: "", bodyUnavailable: "binary" }; }
  }
  const body = truncateText(result.body || "", MAX_CAPTURE_BODY_BYTES);
  return { resBody: body, bodyUnavailable: body !== result.body ? "large" : null };
}
