import { createMemo, Show } from "solid-js";
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

export function RuleEditor(props) {
  const existingRule = createMemo(() => props.directRule ?? (props.req?.ruleId ? findRule(props.req.ruleId) : null) ?? (props.req ? findMatchingRuleForRequest(props.req) : null));
  const draftState = useRuleDraft(props, existingRule);
  const ruleId = createMemo(() => existingRule()?.id ?? null);
  const showGraphQL = createMemo(() => props.req ? !!props.req.graphql : existingRule()?.operationName != null);
  const intercepted = createMemo(() => props.req?.ruleApplied === true && !!(props.req?.ruleId && existingRule() && props.req.ruleId === existingRule().id));
  const diagnostics = createMemo(() => buildRuleDiagnostics(existingRule(), requests(), t));

  const save = () => {
    const currentRuleId = ruleId();
    const rule = ruleFromDraft(draftState.draft, currentRuleId, props.req);
    setDirectEditRule(rule);
    send({ type: "SAVE_RULE", rule });
    showToast(t(currentRuleId ? "ruleUpdated" : "ruleSaved"), "success");
  };

  const deleteRule = () => {
    if (!ruleId()) return;
    send({ type: "DELETE_RULE", ruleId: ruleId() });
    setDirectEditRule(null);
    showToast(t("ruleDeleted"), "success");
  };

  return (
    <div class="rule-editor">
      <RuleContextBanner request={props.req} rule={existingRule()} intercepted={intercepted()} />
      <Show when={diagnostics()}>{(result) => <RuleDiagnostics diag={result()} />}</Show>
      <RuleMatchFields draft={draftState.draft} update={draftState.update} showGraphQL={showGraphQL()} />
      <ErrorSimulationFields
        draft={draftState.draft}
        update={draftState.update}
        applyBlockDefaults={draftState.applyBlockDefaults}
        updateBlockStatus={draftState.updateBlockStatus}
      />
      <ResponseBodyEditor draft={draftState.draft} update={draftState.update} request={props.req} />
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
