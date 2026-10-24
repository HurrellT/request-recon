import { t } from "../../lib/i18n";
import { IconButton } from "../../ui/IconButton";
import { RuleImportExportActions } from "./RuleImportExportActions";

export function SidebarHeader(props) {
  return (
    <header class="sidebar-header">
      <h2 id="rules-sidebar-heading">{t("savedRules")} <span class="sidebar-count">{props.count}</span></h2>
      <div class="sidebar-actions">
        <RuleImportExportActions onExport={props.onExport} onImport={props.onImport} />
        <IconButton icon="x" label={t("close")} class="sidebar-close-btn" onClick={props.onClose} />
      </div>
    </header>
  );
}
