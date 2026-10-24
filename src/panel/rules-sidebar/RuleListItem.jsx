import { Show } from "solid-js";
import { t } from "../../lib/i18n";
import { truncate } from "../../lib/request-utils";
import { MethodBadge } from "../../ui/Badges";
import { Button, ToggleSwitch } from "../../ui/Controls";
import { Icon } from "../../ui/Icon";
import { IconButton } from "../../ui/IconButton";

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
        <span class="rule-item-info">
          <span class="rule-name" title={name()}>
            {name()}
            <Show when={props.rule.blockRequest}>
              <span class="rule-block-icon" role="img" aria-label={t("blockedRuleTitle")} title={t("blockedRuleTitle")}><Icon name="ban" size="sm" /></span>
            </Show>
          </span>
          <span class="rule-meta">
            <Show when={props.rule.method && props.rule.method !== "*"}>
              <MethodBadge method={props.rule.method} />
            </Show>
            <Show when={props.rule.operationName}>
              <span class="graphql-op">{props.rule.operationName}</span>
            </Show>
            <span class="rule-url" title={props.rule.urlPattern}>{truncate(props.rule.urlPattern || "", 30)}</span>
          </span>
        </span>
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
