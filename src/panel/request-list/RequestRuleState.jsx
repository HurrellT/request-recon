import { Show } from "solid-js";
import { t } from "../../lib/i18n";
import { Icon } from "../../ui/Icon";

const visuals = {
  intercepted: { icon: "bolt", label: "interceptedShort", title: "interceptedTitle" },
  pending: { icon: "clock", label: "pendingRuleShort", title: "pendingRuleTitle" },
  blocked: { icon: "ban", label: "blockedShort", title: "blockedRequest" },
};

export function RequestRuleState(props) {
  return (
    <Show when={visuals[props.state]}>
      {(visual) => (
        <span class={`request-rule-state ${props.state}`} title={t(visual().title)}>
          <Icon name={visual().icon} size="sm" />
          <span>{t(visual().label)}</span>
        </span>
      )}
    </Show>
  );
}
