import { createMemo, Show } from "solid-js";
import { Icon } from "../../ui/Icon";
import { t } from "../../lib/i18n";
import { activeTab, currentDirectRule, ruleStateForRequest, selectedRequest, setActiveTab } from "../store";
import { DetailHeader } from "./DetailHeader";
import { DetailTabs } from "./DetailTabs";
import { RequestDetails } from "./RequestDetails";
import { ResponseDetails } from "./ResponseDetails";

export function RequestDetail(props) {
  const currentTab = createMemo(() => selectedRequest() ? activeTab() : "rule");

  return (
    <section id="detail-panel" aria-label={t("requestDetails")}>
      <Show
        when={selectedRequest() || currentDirectRule()}
        fallback={
          <div id="no-selection">
            <Icon name="file-description" size="lg" />
            <div>{t("selectRequest")}</div>
          </div>
        }
      >
        <DetailHeader request={selectedRequest()} rule={currentDirectRule()} ruleState={ruleStateForRequest(selectedRequest())} />
        <DetailTabs hasRequest={!!selectedRequest()} activeTab={currentTab()} onChange={setActiveTab} />
        <div id="tab-content" role="tabpanel" aria-labelledby={`detail-tab-${currentTab()}`} tabindex="0">
          <Show when={selectedRequest()} fallback={props.renderRuleEditor(null, currentDirectRule(), true)}>
            {(req) => (
              <>
                <Show when={currentTab() === "request"}><RequestDetails request={req()} /></Show>
                <Show when={currentTab() === "response"}><ResponseDetails request={req()} /></Show>
                <div hidden={currentTab() !== "rule"}>{props.renderRuleEditor(req(), currentDirectRule(), currentTab() === "rule")}</div>
              </>
            )}
          </Show>
        </div>
      </Show>
    </section>
  );
}
