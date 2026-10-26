import { validateRule, validateRules } from "../src/lib/rules.js";
import { MAX_RULES } from "../src/lib/limits.js";

export function createRuleRepository(storage, onChanged) {
  let cached;
  let version = 0;
  let queue = Promise.resolve();
  let invalidCount = 0;
  const sanitize = (value) => {
    invalidCount = 0;
    if (!Array.isArray(value)) { invalidCount = 1; return []; }
    invalidCount = Math.max(0, value.length - MAX_RULES);
    const ids = new Set();
    const valid = value.slice(0, MAX_RULES).flatMap((entry) => {
      try {
        const rule = validateRule(entry);
        if (!rule.id || ids.has(rule.id)) throw new Error("Invalid rule ID");
        ids.add(rule.id);
        return [rule];
      } catch (_) { invalidCount++; return []; }
    });
    try { return validateRules(valid); }
    catch (_) { invalidCount += valid.length; return []; }
  };
  const listener = (changes, area) => {
    if (area === "local" && changes.rules) {
      version++;
      cached = sanitize(changes.rules.newValue ?? []);
    }
  };
  onChanged.addListener(listener);
  let loading;
  const load = async () => {
    if (cached) return cached;
    if (!loading) {
      const readVersion = version;
      loading = storage.get("rules").then(({ rules = [] }) => {
        if (readVersion === version) cached = sanitize(rules);
        return cached;
      }).finally(() => { loading = null; });
    }
    return loading;
  };
  const mutate = (transform) => {
    const task = queue.then(async () => {
      const next = validateRules(transform(structuredClone(await load())));
      await storage.set({ rules: next });
      cached = next;
      return next;
    });
    queue = task.catch(() => {});
    return task;
  };
  const now = () => new Date().toISOString();
  return {
    load,
    get invalidCount() { return invalidCount; },
    save: (input) => {
      const rule = validateRule(input);
      return mutate((rules) => {
        const index = rules.findIndex((entry) => entry.id === rule.id);
        const updatedAt = now();
        if (index >= 0) rules[index] = { ...rule, createdAt: rules[index].createdAt || updatedAt, updatedAt };
        else rules.unshift({ ...rule, id: rule.id || crypto.randomUUID(), createdAt: updatedAt, updatedAt });
        return rules;
      });
    },
    remove: (id) => mutate((rules) => rules.filter((rule) => rule.id !== id)),
    toggle: (id, enabled) => {
      if (typeof enabled !== "boolean") throw new Error("Invalid enabled value");
      return mutate((rules) => rules.map((rule) => rule.id === id ? { ...rule, enabled, updatedAt: now() } : rule));
    },
    toggleAll: (enabled) => {
      if (typeof enabled !== "boolean") throw new Error("Invalid enabled value");
      return mutate((rules) => rules.map((rule) => ({ ...rule, enabled, updatedAt: now() })));
    },
    import: (input) => {
      const incoming = validateRules(input);
      return mutate((rules) => {
        const ids = new Set(rules.map((rule) => rule.id));
        const added = incoming.map((rule) => {
          const id = !rule.id || ids.has(rule.id) ? crypto.randomUUID() : rule.id;
          ids.add(id);
          return { ...rule, id, enabled: false, createdAt: now(), updatedAt: now() };
        });
        return [...added, ...rules];
      });
    },
    dispose: () => onChanged.removeListener(listener),
  };
}
