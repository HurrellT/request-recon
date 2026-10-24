import { For, Show } from "solid-js";
import { t } from "../../lib/i18n";
import { EmptyState } from "../../ui/EmptyState";
import { RuleListItem } from "./RuleListItem";

export function RuleList(props) {
  return (
    <ul id="rules-list" aria-labelledby="rules-sidebar-heading">
      <Show
        when={props.rules.length > 0}
        fallback={
          <li class="rules-list-empty">
            <EmptyState title={t("noRules")}>
              {t("noRulesPanel")} <strong>{t("ruleTab")}</strong>
            </EmptyState>
          </li>
        }
      >
        <For each={props.rules}>
          {(rule) => (
            <RuleListItem
              rule={rule}
              selected={props.selectedRuleId === rule.id}
              onEdit={props.onEdit}
              onToggle={props.onToggle}
              onDelete={props.onDelete}
            />
          )}
        </For>
      </Show>
    </ul>
  );
}
