export const MAX_RULES = 500;
export const MAX_RULE_BODY_BYTES = 1024 * 1024;
export const MAX_RULE_FILE_BYTES = 8 * 1024 * 1024;
export const MAX_PATTERN_LENGTH = 2048;
export const MAX_URL_LENGTH = 16 * 1024;
export const MAX_CAPTURE_BODY_BYTES = 256 * 1024;
export const MAX_REQUEST_BODY_BYTES = 64 * 1024;
export const MAX_CAPTURE_BYTES = 32 * 1024 * 1024;
export const MAX_REQUESTS = 1000;

export const byteLength = (value) => new TextEncoder().encode(value).byteLength;

export function truncateText(value, limit) {
  const text = typeof value === "string" ? value : "";
  if (text.length <= limit / 4) return text;
  const bytes = new TextEncoder().encode(text.slice(0, limit));
  if (text.length <= limit && bytes.length <= limit) return text;
  return new TextDecoder().decode(bytes.subarray(0, limit)).replace(/\ufffd$/, "");
}

// Approximate retained string memory, including metadata and both bodies.
export const requestBytes = (request) => JSON.stringify(request).length * 2;
