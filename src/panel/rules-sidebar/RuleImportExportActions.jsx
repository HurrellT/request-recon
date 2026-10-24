import { t } from "../../lib/i18n";
import { Input } from "../../ui/Controls";
import { IconButton } from "../../ui/IconButton";

export function RuleImportExportActions(props) {
  let fileInput;

  const importSelectedFile = (event) => {
    const file = event.currentTarget.files?.[0];
    event.currentTarget.value = "";
    if (file) props.onImport(file);
  };

  return (
    <div class="sidebar-import-export">
      <IconButton icon="download" label={t("exportRules")} onClick={props.onExport} />
      <IconButton icon="upload" label={t("importRules")} onClick={() => fileInput?.click()} />
      <Input ref={fileInput} type="file" accept=".json,application/json" hidden onChange={importSelectedFile} />
    </div>
  );
}
