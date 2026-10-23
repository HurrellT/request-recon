import { For, Show } from "solid-js";
import { t } from "../../lib/i18n";
import { requestRuleState } from "../../lib/request-utils";
import {
  findMatchingRuleForRequest,
  findRule,
  hiddenRequestCount,
  matchingRequests,
  requests,
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

function stateForRequest(req) {
  const matchedRule = (req.ruleId ? findRule(req.ruleId) : null) ?? findMatchingRuleForRequest(req);
  return requestRuleState(req, matchedRule);
}

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
                  ruleState={stateForRequest(req)}
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
