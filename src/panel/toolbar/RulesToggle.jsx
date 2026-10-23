import { Show } from "solid-js";
import { t } from "../../lib/i18n";
import { Icon } from "../../ui/Icon";

export function RulesToggle(props) {
  return (
    <button
      type="button"
      class="toolbar-btn"
      id="rules-toggle-btn"
      title={t("savedRulesTitle")}
      aria-expanded={props.open}
      aria-controls="rules-sidebar"
      onClick={props.onToggle}
    >
      <Icon name="list-details" />
      <span>{t("rules")}</span>
      <Show when={props.activeCount > 0}><span id="rules-count">{props.activeCount}</span></Show>
    </button>
  );
}
