export const TRAFFIC_CATEGORIES = ["preflight", "assets", "navigation"];

export const DEFAULT_TRAFFIC_VISIBILITY = {
  preflight: false,
  assets: false,
  navigation: false,
};

function headerValue(headers, name) {
  const target = name.toLowerCase();
  if (Array.isArray(headers)) {
    return headers.find((header) => header.name?.toLowerCase() === target)?.value || "";
  }
  const key = Object.keys(headers || {}).find((header) => header.toLowerCase() === target);
  return key ? String(headers[key]) : "";
}

export function getTrafficCategory(req) {
  const method = (req.method || "").toUpperCase();
  if (method === "OPTIONS" && headerValue(req.reqHeaders, "access-control-request-method")) {
    return "preflight";
  }

  let url;
  try {
    url = new URL(req.url);
  } catch (_) {
    return null;
  }

  const path = url.pathname;
  const contentType = headerValue(req.resHeaders, "content-type").toLowerCase();
  const isNavigationPayload = method === "GET" && (
    url.searchParams.has("_rsc") ||
    contentType.includes("text/x-component") ||
    headerValue(req.reqHeaders, "rsc") === "1" ||
    /\.rsc$/.test(path) ||
    /(?:^|\/)__data\.json$/.test(path) ||
    /(?:^|\/)_payload\.json$/.test(path) ||
    (/\.data$/.test(path) && (
      contentType.includes("text/x-script") ||
      contentType.includes("text/x-turbo") ||
      !!headerValue(req.resHeaders, "x-remix-response")
    ))
  );
  if (isNavigationPayload) return "navigation";

  const type = (req.resourceType || "").toLowerCase();
  if (["script", "stylesheet", "font", "image", "media"].includes(type)) return "assets";
  if (/^\/(?:_next\/static\/|_next\/image$|_nuxt\/|_astro\/|_app\/immutable\/|@vite\/|@react-refresh(?:\/|$)|node_modules\/\.vite\/)/.test(path)) {
    return "assets";
  }

  return null;
}

export function isAlwaysVisible(req) {
  return req.resStatus >= 400 || !!req.responseErrorReason || req.networkFailureApplied || req.ruleApplied === true || !!req.ruleId;
}

export function isHiddenByTrafficFilter(req, visibility) {
  const category = req.trafficCategory ?? getTrafficCategory(req);
  return !!category && !visibility[category] && !isAlwaysVisible(req);
}
