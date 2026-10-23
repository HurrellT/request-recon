import { Match, Switch } from "solid-js";
import { t } from "../../lib/i18n";
import { EmptyState } from "../../ui/EmptyState";

export function RequestListEmptyState(props) {
  return (
    <li class="request-list-empty">
      <Switch>
        <Match when={props.totalCount === 0}>
          <EmptyState title={t("noRequests")}>
            {t("pressStart")} <strong>{t("start")}</strong> {t("toBegin")}
          </EmptyState>
        </Match>
        <Match when={props.matchingCount === 0}>
          <EmptyState
            title={t("noMatches")}
            action={<button type="button" class="btn btn-secondary" onClick={props.onClearFilters}>{t("clearFilters")}</button>}
          >
            {t("adjustFilters")}
          </EmptyState>
        </Match>
        <Match when={true}>
          <EmptyState
            title={t("hiddenRequests", { count: props.hiddenCount })}
            action={<button type="button" class="btn btn-secondary" onClick={props.onShowAll}>{t("showAll")}</button>}
          >
            {t("hiddenRequestsHint")}
          </EmptyState>
        </Match>
      </Switch>
    </li>
  );
}
