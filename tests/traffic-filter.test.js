import test from "node:test";
import assert from "node:assert/strict";
import { DEFAULT_TRAFFIC_VISIBILITY, getTrafficCategory, isHiddenByTrafficFilter } from "../src/lib/traffic-filter.js";

const request = (url, extras = {}) => ({
  url,
  method: "GET",
  resourceType: "Fetch",
  reqHeaders: {},
  resHeaders: [],
  resStatus: 200,
  ...extras,
});

test("classifies framework navigation payloads without hiding ordinary API calls", () => {
  const cases = [
    ["https://example.com/es/transfers?_rsc=abc", "navigation"],
    ["https://example.com/es/transfers", "navigation", { resHeaders: [{ name: "Content-Type", value: "text/x-component" }] }],
    ["https://example.com/products/_payload.json", "navigation"],
    ["https://example.com/products/__data.json", "navigation"],
    ["https://example.com/products.data", "navigation", { resHeaders: [{ name: "Content-Type", value: "text/x-script" }] }],
    ["https://example.com/api/report.data", null],
    ["https://example.com/api/products", null],
    ["https://dummyjson.com/users/1", null],
  ];

  for (const [url, expected, extras] of cases) {
    assert.equal(getTrafficCategory(request(url, extras)), expected, url);
  }
});

test("hides static resources and actual CORS preflights, not every OPTIONS request", () => {
  assert.equal(getTrafficCategory(request("https://example.com/_next/static/chunks/app.js")), "assets");
  assert.equal(getTrafficCategory(request("http://localhost:5173/@vite/client")), "assets");
  assert.equal(getTrafficCategory(request("https://example.com/logo.png", { resourceType: "Image" })), "assets");
  assert.equal(getTrafficCategory(request("https://dummyjson.com/users/1", {
    method: "OPTIONS",
    reqHeaders: { "Access-Control-Request-Method": "GET" },
  })), "preflight");
  assert.equal(getTrafficCategory(request("https://example.com/api/options", { method: "OPTIONS" })), null);
});

test("shows hidden categories on demand and always exposes errors and matched rules", () => {
  const rsc = request("https://example.com/es/transfers?_rsc=abc");
  const asset = request("https://example.com/_next/static/chunks/app.js");
  const preflight = request("https://dummyjson.com/users/1", {
    method: "OPTIONS",
    reqHeaders: { "Access-Control-Request-Method": "GET" },
  });
  assert.equal(isHiddenByTrafficFilter(rsc, DEFAULT_TRAFFIC_VISIBILITY), true);
  assert.equal(isHiddenByTrafficFilter(asset, DEFAULT_TRAFFIC_VISIBILITY), true);
  assert.equal(isHiddenByTrafficFilter(preflight, DEFAULT_TRAFFIC_VISIBILITY), true);
  assert.equal(isHiddenByTrafficFilter(rsc, { ...DEFAULT_TRAFFIC_VISIBILITY, navigation: true }), false);
  assert.equal(isHiddenByTrafficFilter(request("https://dummyjson.com/users/1"), DEFAULT_TRAFFIC_VISIBILITY), false);
  assert.equal(isHiddenByTrafficFilter({ ...rsc, resStatus: 500 }, DEFAULT_TRAFFIC_VISIBILITY), false);
  assert.equal(isHiddenByTrafficFilter({ ...rsc, ruleId: "rule-1" }, DEFAULT_TRAFFIC_VISIBILITY), false);
  assert.equal(isHiddenByTrafficFilter({ ...rsc, ruleApplied: true }, DEFAULT_TRAFFIC_VISIBILITY), false);
});
