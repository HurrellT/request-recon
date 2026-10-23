import { t } from "../../lib/i18n";
import { Icon } from "../../ui/Icon";

export function RequestSearch(props) {
  return (
    <div class="toolbar-search-field">
      <label for="filter-input" class="sr-only">{t("searchLabel")}</label>
      <Icon name="search" />
      <input
        type="text"
        id="filter-input"
        placeholder={t("searchPlaceholder")}
        value={props.value}
        onInput={(event) => props.onInput(event.currentTarget.value)}
      />
    </div>
  );
}
