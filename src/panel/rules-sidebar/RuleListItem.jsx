import { t } from "../../lib/i18n";
import { Button, ToggleSwitch } from "../../ui/Controls";
import { Icon } from "../../ui/Icon";
import { IconButton } from "../../ui/IconButton";
import { RuleSummary } from "../../ui/RuleSummary";

export function RuleListItem(props) {
  const name = () => props.rule.name || props.rule.urlPattern || t("unnamed");

  return (
    <li class="rule-item" classList={{ disabled: !props.rule.enabled, selected: props.selected }}>
      <ToggleSwitch
        label={`${props.rule.enabled ? t("disable") : t("enable")}: ${name()}`}
        checked={!!props.rule.enabled}
        onChange={(checked) => props.onToggle(props.rule, checked)}
      />
      <Button
        class="rule-edit-btn"
        aria-label={t("editRuleNamed", { name: name() })}
        aria-current={props.selected ? "true" : undefined}
        onClick={() => props.onEdit(props.rule)}
      >
        <RuleSummary rule={props.rule} />
        <Icon name="pencil" class="rule-edit-icon" size="sm" />
      </Button>
      <IconButton
        icon="trash"
        label={`${t("delete")}: ${name()}`}
        class="rule-delete-btn"
        onClick={(event) => props.onDelete(props.rule, event)}
      />
    </li>
  );
}
