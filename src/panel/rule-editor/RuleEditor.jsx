import { createEffect, createMemo, createSignal, onCleanup, Show } from "solid-js";
import { t } from "../../lib/i18n";
import { findMatchingRuleForRequest, findRule, requests, send, setDirectEditRule, showToast } from "../store";
import { buildRuleDiagnostics } from "./diagnostics";
import { ruleFromDraft } from "./draft";
import { useRuleDraft } from "./useRuleDraft";
import { ErrorSimulationFields } from "./ErrorSimulationFields";
import { ResponseBodyEditor } from "./ResponseBodyEditor";
import { RuleActions } from "./RuleActions";
import { RuleContextBanner } from "./RuleContextBanner";
import { RuleDiagnostics } from "./RuleDiagnostics";
import { RuleMatchFields } from "./RuleMatchFields";
import { AiRuleGenerator } from "./AiRuleGenerator";

export function RuleEditor(props) {
  const matchingRule = createMemo(() => props.directRule ?? (props.req?.ruleId ? findRule(props.req.ruleId) : null) ?? (props.req ? findMatchingRuleForRequest(props.req) : null));
  const draftState = useRuleDraft(props, matchingRule);
  const existingRule = draftState.rule;
  const [busy, setBusy] = createSignal(false);
  const ruleId = createMemo(() => existingRule()?.id ?? null);
  const showGraphQL = createMemo(() => props.req ? !!props.req.graphql : existingRule()?.operationName != null);
  const intercepted = createMemo(() => props.req?.ruleApplied === true && !!(props.req?.ruleId && existingRule() && props.req.ruleId === existingRule().id));
  const diagnostics = createMemo(() => props.active === false ? null : buildRuleDiagnostics({
    urlPattern: draftState.draft.urlPattern, url: draftState.draft.url, method: draftState.draft.method,
    operationName: draftState.draft.operationName, bodyContains: draftState.draft.bodyContains,
  }, requests(), t));

  const save = async () => {
    if (busy()) return;
    const currentRuleId = ruleId();
    const targetKey = draftState.targetKey();
    let rule;
    try { rule = ruleFromDraft(draftState.draft, currentRuleId, props.req); }
    catch (error) { showToast(t("invalidRule", { details: error.message }), "error"); return; }
    setBusy(true);
    try {
      await send({ type: "SAVE_RULE", rule });
      draftState.markSaved(targetKey);
      if (draftState.targetKey() === targetKey) setDirectEditRule({ id: rule.id });
      showToast(t(currentRuleId ? "ruleUpdated" : "ruleSaved"), "success");
    } catch (_) { /* messaging reports the error */ }
    finally { setBusy(false); }
  };

  createEffect(() => {
    if (props.active === false) return;
    const onKeyDown = (event) => {
      if (!(event.metaKey || event.ctrlKey) || event.altKey || event.shiftKey || event.key.toLowerCase() !== "s") return;
      event.preventDefault();
      if (!event.repeat) void save();
    };
    // Capture before the code editor handles keyboard events.
    document.addEventListener("keydown", onKeyDown, true);
    onCleanup(() => document.removeEventListener("keydown", onKeyDown, true));
  });

  const deleteRule = async () => {
    if (!ruleId() || busy()) return;
    const targetKey = draftState.targetKey();
    const currentRuleId = ruleId();
    setBusy(true);
    try {
      await send({ type: "DELETE_RULE", ruleId: currentRuleId });
      draftState.markSaved(targetKey);
      if (draftState.targetKey() === targetKey) setDirectEditRule(null);
      showToast(t("ruleDeleted"), "success");
    } catch (_) { /* messaging reports the error */ }
    finally { setBusy(false); }
  };

  return (
    <div class="rule-editor" aria-busy={busy()} inert={busy()}>
      <RuleContextBanner request={props.req} rule={existingRule()} intercepted={intercepted()} />
      <Show when={props.req}>
        <AiRuleGenerator request={props.req} active={props.active !== false} targetKey={draftState.targetKey()} onApply={draftState.startGeneratedDraft} />
      </Show>
      <Show when={diagnostics()}>{(result) => <RuleDiagnostics diag={result()} />}</Show>
      <RuleMatchFields draft={draftState.draft} update={draftState.update} showGraphQL={showGraphQL()} />
      <ErrorSimulationFields
        draft={draftState.draft}
        update={draftState.update}
        applyBlockDefaults={draftState.applyBlockDefaults}
        updateBlockStatus={draftState.updateBlockStatus}
      />
      <Show when={props.active !== false}>
        <ResponseBodyEditor draft={draftState.draft} update={draftState.update} request={props.req} />
      </Show>
      <RuleActions
        ruleId={ruleId()}
        enabled={draftState.draft.enabled}
        onEnabledChange={(enabled) => draftState.update("enabled", enabled)}
        onDelete={deleteRule}
        onSave={save}
      />
    </div>
  );
}
