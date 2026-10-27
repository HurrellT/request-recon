import { createEffect, createSignal, on } from "solid-js";
import { createStore } from "solid-js/store";
import { prettyJSON } from "../../lib/request-utils.js";
import { t } from "../../lib/i18n.js";
import { draftFromGeneration, initialRuleDraft } from "./draft.js";

export function useRuleDraft(props, existingRule) {
  const [draft, setDraft] = createStore(initialRuleDraft(null, null));
  const [dirty, setDirty] = createSignal(false);
  const [newRuleSelection, setNewRuleSelection] = createSignal(null);
  let currentTarget;
  const drafts = new Map();

  const selectionKey = () => props.directRule ? `rule:${props.directRule.id}` : props.req ? `request:${props.req.id}` : "none";
  const rule = () => newRuleSelection() === selectionKey() ? null : existingRule();
  const targetKey = () => `${selectionKey()}${newRuleSelection() === selectionKey() ? ":new" : ""}`;

  createEffect(on(selectionKey, () => setNewRuleSelection(null)));

  createEffect(on([targetKey, rule], ([key, rule]) => {
    if (key !== currentTarget || !dirty()) {
      if (key !== currentTarget && dirty()) {
        drafts.set(currentTarget, { ...draft });
        if (drafts.size > 20) drafts.delete(drafts.keys().next().value);
      }
      const savedDraft = drafts.get(key);
      setDraft(savedDraft ?? initialRuleDraft(rule, props.req));
      setDirty(!!savedDraft);
      currentTarget = key;
    }
  }));

  const update = (field, value) => {
    setDraft(field, value);
    setDirty(true);
  };

  const applyBlockDefaults = (nextBlockRequest = draft.blockRequest, nextBlockType = draft.blockType, nextBlockStatus = draft.blockStatus) => {
    if (nextBlockRequest && nextBlockType !== "network-fail" && !draft.responseBody.trim()) {
      update("responseBody", prettyJSON(JSON.stringify({ error: t("blockedRequest"), status: Number(nextBlockStatus) })));
      update("overrideBody", true);
    }
  };

  const updateBlockStatus = (value) => {
    update("blockStatus", value);
    if (draft.blockRequest && draft.blockType !== "network-fail") {
      try {
        const parsed = JSON.parse(draft.responseBody);
        if (parsed.status !== undefined) {
          parsed.status = parseInt(value, 10);
          update("responseBody", JSON.stringify(parsed, null, 2));
        }
      } catch (_) {}
    }
    applyBlockDefaults(draft.blockRequest, draft.blockType, value);
  };

  const markSaved = (key = currentTarget) => {
    drafts.delete(key);
    if (key === currentTarget) setDirty(false);
  };
  const startGeneratedDraft = (proposal) => {
    if (!props.req) return;
    const next = draftFromGeneration(props.req, proposal);
    if (dirty()) drafts.set(currentTarget, { ...draft });
    setNewRuleSelection(selectionKey());
    currentTarget = targetKey();
    drafts.delete(currentTarget);
    setDraft(next);
    setDirty(true);
  };
  return { draft, rule, update, applyBlockDefaults, updateBlockStatus, markSaved, targetKey, startGeneratedDraft };
}
