export function parseRulesFile(contents) {
  const parsed = JSON.parse(contents);
  const rules = Array.isArray(parsed) ? parsed : [parsed];
  if (rules.some((rule) => !rule || typeof rule !== "object" || Array.isArray(rule) || Object.keys(rule).length === 0)) {
    throw new Error("Invalid rules file");
  }
  return rules;
}
