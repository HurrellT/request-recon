import { For, Show } from "solid-js";
import { t } from "../../lib/i18n";
import {
  hiddenRequestCount,
  matchingRequests,
  requests,
  ruleStateForRequest,
  selectedRequest,
  setAllTrafficVisible,
  setDirectEditRule,
  setFilterText,
  setMethodFilter,
  setSelectedId,
  visibleRequests,
} from "../store";
import { RequestListEmptyState } from "./RequestListEmptyState";
import { RequestListHeader } from "./RequestListHeader";
import { RequestRow } from "./RequestRow";

export function RequestList() {
  const clearFilters = () => {
    setFilterText("");
    setMethodFilter("");
  };

  return (
    <section id="request-list-panel" aria-label={t("requests")}>
      <RequestListHeader visibleCount={visibleRequests().length} matchingCount={matchingRequests().length} />
      <ul id="request-list" aria-label={t("requests")}>
        <Show
          when={visibleRequests().length > 0}
          fallback={
            <RequestListEmptyState
              totalCount={requests().length}
              matchingCount={matchingRequests().length}
              hiddenCount={hiddenRequestCount()}
              onShowAll={() => setAllTrafficVisible(true)}
              onClearFilters={clearFilters}
            />
          }
        >
          <For each={visibleRequests()}>
            {(req) => (
              <li class="request-list-entry">
                <RequestRow
                  req={req}
                  selected={req.id === selectedRequest()?.id}
                  ruleState={ruleStateForRequest(req)}
                  onSelect={() => {
                    setSelectedId(req.id);
                    setDirectEditRule(null);
                  }}
                />
              </li>
            )}
          </For>
        </Show>
      </ul>
    </section>
  );
}
