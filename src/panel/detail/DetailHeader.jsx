import { Show } from "solid-js";
import { getResponseOutcome } from "../../lib/request-utils";
import { t } from "../../lib/i18n";
import { MethodBadge, StatusBadge } from "../../ui/Badges";
import { Icon } from "../../ui/Icon";

export function DetailHeader(props) {
  const method = () => props.request?.method ?? (props.rule?.method !== "*" ? props.rule?.method : "-");
  const outcome = () => getResponseOutcome(props.request);
  const networkFailure = () => outcome().networkFailure || (!props.request && props.rule?.blockRequest && props.rule?.blockType === "network-fail");
  const status = () => {
    if (networkFailure()) return t("networkFailureShort");
    if (props.request) return outcome().status ?? t("pendingStatus");
    if (props.rule?.blockRequest) return props.rule.blockStatus ?? props.rule.statusCode ?? "-";
    return props.rule?.statusCode ?? "-";
  };
  const url = () => props.request?.url ?? props.rule?.urlPattern ?? props.rule?.name ?? "";

  return (
    <header id="detail-header">
      <div class="detail-meta">
        <MethodBadge method={method()} detail />
        <span class="detail-status">
          <span class="detail-status-label">{props.request?.ruleApplied ? t("appliedStatusLabel") : props.request ? t("responseStatusLabel") : t("configuredStatusLabel")}</span>
          <StatusBadge status={status()} tone={networkFailure() ? "error" : undefined} />
        </span>
        <Show when={props.request?.ruleApplied && props.request?.resStatus != null}>
          <span class="detail-original-status">{t("originalStatusTitle", { status: props.request.resStatus })}</span>
        </Show>
        <Show when={props.request?.graphql?.operationName ?? props.rule?.operationName}>
          <span class="detail-graphql-op">{props.request?.graphql?.operationName ?? props.rule?.operationName}</span>
        </Show>
        <Show when={props.ruleState === "intercepted" || props.ruleState === "blocked"}>
          <span
            class="detail-rule-state"
            classList={{ blocked: props.ruleState === "blocked" }}
            title={t(props.ruleState === "blocked" ? "blockedRequest" : "interceptedTitle")}
          >
            <Icon name={props.ruleState === "blocked" ? "ban" : "bolt"} size="sm" />
            {t(props.ruleState === "blocked" ? "blockedShort" : "interceptedShort")}
          </span>
        </Show>
      </div>
      <div id="detail-url" title={url()}>{url()}</div>
    </header>
  );
}
