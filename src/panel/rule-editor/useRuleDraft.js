import { createEffect, createSignal, on } from "solid-js";
import { createStore } from "solid-js/store";
import { prettyJSON } from "../../lib/request-utils";
import { t } from "../../lib/i18n";
import { initialRuleDraft } from "./draft";

export function useRuleDraft(props, existingRule) {
  const [draft, setDraft] = createStore(initialRuleDraft(null, null));
  const [dirty, setDirty] = createSignal(false);
  let currentTarget;

  const targetKey = () => props.req ? `request:${props.req.id}` : props.directRule ? `rule:${props.directRule.id}` : "none";

  createEffect(on([targetKey, existingRule], ([key, rule]) => {
    if (key !== currentTarget || !dirty()) {
      setDraft(initialRuleDraft(rule, props.req));
      setDirty(false);
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

  return { draft, update, applyBlockDefaults, updateBlockStatus };
}
