import { t } from "../lib/i18n";
import { ToggleSwitch } from "../ui/Controls";
import { RuleSummary } from "../ui/RuleSummary";

export function PopupRuleItem(props) {
  const name = () => props.rule.name || props.rule.urlPattern || t("unnamed");

  return (
    <li class="popup-rule-item" classList={{ disabled: !props.rule.enabled }}>
      <ToggleSwitch
        label={`${props.rule.enabled ? t("disable") : t("enable")}: ${name()}`}
        checked={!!props.rule.enabled}
        disabled={props.busy}
        onChange={(checked) => props.onToggle(props.rule.id, checked)}
      />
      <RuleSummary rule={props.rule} />
    </li>
  );
}
