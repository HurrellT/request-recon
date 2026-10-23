import { createMemo, Show, Switch, Match } from "solid-js";
import { Icon } from "../../ui/Icon";
import { t } from "../../lib/i18n";
import { activeTab, directEditRule, selectedRequest, setActiveTab } from "../store";
import { DetailHeader } from "./DetailHeader";
import { DetailTabs } from "./DetailTabs";
import { RequestDetails } from "./RequestDetails";
import { ResponseDetails } from "./ResponseDetails";

export function RequestDetail(props) {
  const currentTab = createMemo(() => selectedRequest() ? activeTab() : "rule");

  return (
    <section id="detail-panel" aria-label={t("requestDetails")}>
      <Show
        when={selectedRequest() || directEditRule()}
        fallback={
          <div id="no-selection">
            <Icon name="file-description" size="lg" />
            <div>{t("selectRequest")}</div>
          </div>
        }
      >
        <DetailHeader request={selectedRequest()} rule={directEditRule()} />
        <DetailTabs hasRequest={!!selectedRequest()} activeTab={currentTab()} onChange={setActiveTab} />
        <div id="tab-content" role="tabpanel" aria-labelledby={`detail-tab-${currentTab()}`} tabindex="0">
          <Show when={selectedRequest()} fallback={props.renderRuleEditor(null, directEditRule())}>
            {(req) => (
              <Switch>
                <Match when={currentTab() === "request"}><RequestDetails request={req()} /></Match>
                <Match when={currentTab() === "response"}><ResponseDetails request={req()} /></Match>
                <Match when={true}>{props.renderRuleEditor(req(), null)}</Match>
              </Switch>
            )}
          </Show>
        </div>
      </Show>
    </section>
  );
}
