import { For, Show } from "solid-js";
import { t } from "../lib/i18n";
import { EmptyState } from "../ui/EmptyState";
import { Icon } from "../ui/Icon";
import { PopupRuleItem } from "./PopupRuleItem";

export function PopupRuleList(props) {
  return (
    <section id="popup-rules-section" aria-labelledby="popup-rules-heading">
      <div class="popup-section-heading">
        <Icon name="list-details" />
        <h2 id="popup-rules-heading">{t("savedRules")}</h2>
        <span class="popup-rule-count">{props.rules.length}</span>
      </div>
      <Show
        when={props.rules.length > 0}
        fallback={
          <EmptyState class="popup-empty" title={t("noRules")}>
            {t("noRulesPopup")}
          </EmptyState>
        }
      >
        <ul class="popup-rules-list">
          <For each={props.rules}>
            {(rule) => <PopupRuleItem rule={rule} onToggle={props.onToggle} />}
          </For>
        </ul>
      </Show>
    </section>
  );
}
