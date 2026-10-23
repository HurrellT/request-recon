import { t } from "../../lib/i18n";
import { Icon } from "../../ui/Icon";
import { FieldLabel, Input } from "../../ui/Controls";

export function RequestSearch(props) {
  return (
    <div class="toolbar-search-field">
      <FieldLabel for="filter-input" class="sr-only">{t("searchLabel")}</FieldLabel>
      <Icon name="search" />
      <Input
        type="text"
        id="filter-input"
        placeholder={t("searchPlaceholder")}
        value={props.value}
        onInput={(event) => props.onInput(event.currentTarget.value)}
      />
    </div>
  );
}
