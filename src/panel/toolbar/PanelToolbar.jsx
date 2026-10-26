import { createMemo } from "solid-js";
import { chooseLanguage, language, t } from "../../lib/i18n";
import { Icon } from "../../ui/Icon";
import { Button } from "../../ui/Controls";
import {
  clearRequests,
  filterText,
  hiddenCategoryCounts,
  hiddenRequestCount,
  isRecording,
  methodFilter,
  rules,
  send,
  setAllTrafficVisible,
  setFilterText,
  setMethodFilter,
  setShowRulesSidebar,
  showRulesSidebar,
  trafficVisibility,
  updateTrafficVisibility,
} from "../store";
import { LanguageSelector } from "./LanguageSelector";
import { MethodFilter } from "./MethodFilter";
import { RecordingControl } from "./RecordingControl";
import { RequestSearch } from "./RequestSearch";
import { RulesToggle } from "./RulesToggle";
import { TrafficFilterMenu } from "./TrafficFilterMenu";

export function PanelToolbar() {
  const activeRulesCount = createMemo(() => rules().filter((rule) => rule.enabled).length);

  return (
    <header id="toolbar">
      <div class="toolbar-capture">
        <RecordingControl recording={isRecording()} onToggle={() => send({ type: isRecording() ? "STOP" : "START" }).catch(() => {})} />
        <Button class="toolbar-btn" title={t("clearTitle")} onClick={clearRequests}>
          <Icon name="trash" />
          <span>{t("clear")}</span>
        </Button>
      </div>

      <div class="toolbar-search">
        <RequestSearch value={filterText()} onInput={setFilterText} />
        <MethodFilter value={methodFilter()} onChange={setMethodFilter} />
      </div>

      <div class="toolbar-utility">
        <TrafficFilterMenu
          hiddenCount={hiddenRequestCount()}
          categoryCounts={hiddenCategoryCounts()}
          visibility={trafficVisibility()}
          onToggle={updateTrafficVisibility}
          onShowAll={() => setAllTrafficVisible(true)}
          onHideNoise={() => setAllTrafficVisible(false)}
        />
        <RulesToggle activeCount={activeRulesCount()} open={showRulesSidebar()} onToggle={() => setShowRulesSidebar((open) => !open)} />
        <LanguageSelector value={language()} onChange={chooseLanguage} />
      </div>
    </header>
  );
}
