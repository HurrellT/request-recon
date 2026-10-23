import { createMemo, Show } from "solid-js";
import { t } from "../../lib/i18n";
import { getBodySummary, getPath, getResponseOutcome, statusDotClass } from "../../lib/request-utils";
import { MethodBadge, StatusBadge } from "../../ui/Badges";
import { RequestRuleState } from "./RequestRuleState";

export function RequestRow(props) {
  const outcome = createMemo(() => getResponseOutcome(props.req));
  const subLabel = createMemo(() => {
    if (props.req.graphql) return { text: props.req.graphql.operationName || "GraphQL", isGql: true };
    const summary = getBodySummary(props.req);
    return summary ? { text: summary, isGql: false } : null;
  });

  return (
    <button
      type="button"
      class="request-item"
      classList={{
        selected: props.selected,
        modified: props.ruleState === "intercepted",
        blocked: props.ruleState === "blocked",
        "has-active-rule": props.ruleState === "pending",
      }}
      aria-current={props.selected ? "true" : undefined}
      title={props.req.url}
      onClick={props.onSelect}
    >
      <MethodBadge method={props.req.method} />
      <span class="request-url">{getPath(props.req.url)}</span>
      <span class="request-status" title={props.req.ruleApplied && props.req.resStatus != null ? t("originalStatusTitle", { status: props.req.resStatus }) : undefined}>
        <span class="sr-only">{t("responseStatusLabel")}: </span>
        <StatusBadge
          status={outcome().networkFailure ? t("networkFailureShort") : outcome().status ?? t("pendingStatus")}
          tone={outcome().networkFailure ? "error" : statusDotClass(outcome().status)}
        />
      </span>
      <RequestRuleState state={props.ruleState} />
      <Show when={subLabel()}>
        {(label) => <span class="req-row-sub" classList={{ "is-gql": label().isGql }}>{label().text}</span>}
      </Show>
    </button>
  );
}
