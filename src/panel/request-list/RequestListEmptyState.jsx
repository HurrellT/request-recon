import { Match, Switch } from "solid-js";
import { t } from "../../lib/i18n";
import { EmptyState } from "../../ui/EmptyState";
import { Button } from "../../ui/Controls";

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
            action={<Button variant="secondary" onClick={props.onClearFilters}>{t("clearFilters")}</Button>}
          >
            {t("adjustFilters")}
          </EmptyState>
        </Match>
        <Match when={true}>
          <EmptyState
            title={t("hiddenRequests", { count: props.hiddenCount })}
            action={<Button variant="secondary" onClick={props.onShowAll}>{t("showAll")}</Button>}
          >
            {t("hiddenRequestsHint")}
          </EmptyState>
        </Match>
      </Switch>
    </li>
  );
}
