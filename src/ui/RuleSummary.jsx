import { Show } from "solid-js";
import { t } from "../lib/i18n";
import { shortPattern } from "../lib/request-utils";
import { MethodBadge } from "./Badges";
import { Icon } from "./Icon";

export function RuleSummary(props) {
  const name = () => props.rule.name || props.rule.urlPattern || t("unnamed");

  return (
    <span class="rule-summary">
      <span class="rule-summary-name" title={name()}>
        <span class="rule-summary-name-text">{name()}</span>
        <Show when={props.rule.blockRequest}>
          <span class="rule-summary-block-icon" role="img" aria-label={t("blockedRuleTitle")} title={t("blockedRuleTitle")}>
            <Icon name="ban" size="sm" />
          </span>
        </Show>
      </span>
      <span class="rule-summary-meta">
        <Show when={props.rule.method && props.rule.method !== "*"}>
          <MethodBadge method={props.rule.method} />
        </Show>
        <Show when={props.rule.operationName}>
          <span class="rule-summary-operation" title={props.rule.operationName}>{props.rule.operationName}</span>
        </Show>
        <span class="rule-summary-url" title={props.rule.urlPattern}>{shortPattern(props.rule.urlPattern)}</span>
      </span>
    </span>
  );
}
