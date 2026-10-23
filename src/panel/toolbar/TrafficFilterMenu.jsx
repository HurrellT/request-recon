import { For, Show } from "solid-js";
import { t } from "../../lib/i18n";
import { Icon } from "../../ui/Icon";
import { Button, CheckboxField } from "../../ui/Controls";

const TRAFFIC_OPTIONS = [
  ["preflight", "corsPreflights"],
  ["assets", "staticResources"],
  ["navigation", "ssrNavigation"],
];

export function TrafficFilterMenu(props) {
  const closeOnEscape = (event) => {
    if (event.key !== "Escape" || !event.currentTarget.open) return;
    event.currentTarget.open = false;
    event.currentTarget.querySelector("summary")?.focus();
    event.preventDefault();
  };

  return (
    <details id="traffic-filter-menu" onKeyDown={closeOnEscape}>
      <summary class="toolbar-btn" title={t("trafficTitle")} aria-label={props.hiddenCount > 0 ? `${t("trafficTitle")}. ${t("hiddenRequests", { count: props.hiddenCount })}` : t("trafficTitle")}>
        <Icon name="filter" />
        <span>{t("traffic")}</span>
        <Show when={props.hiddenCount > 0}><span class="traffic-hidden-count">{props.hiddenCount}</span></Show>
      </summary>
      <div id="traffic-filter-options">
        <div class="traffic-filter-heading">{t("showInList")}</div>
        <For each={TRAFFIC_OPTIONS}>
          {([category, labelKey]) => (
            <CheckboxField
              class="traffic-filter-option"
              label={t(labelKey)}
              checked={props.visibility[category]}
              onChange={(checked) => props.onToggle(category, checked)}
              trailing={<Show when={props.categoryCounts[category] > 0}><span class="traffic-category-count">{props.categoryCounts[category]}</span></Show>}
            />
          )}
        </For>
        <div class="traffic-filter-actions">
          <Button class="toolbar-btn" onClick={props.onShowAll}>{t("showAll")}</Button>
          <Button class="toolbar-btn" onClick={props.onHideNoise}>{t("hideNoise")}</Button>
        </div>
      </div>
    </details>
  );
}
