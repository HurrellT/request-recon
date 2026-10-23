import { t } from "../../lib/i18n";
import { FieldLabel, Select } from "../../ui/Controls";

export function LanguageSelector(props) {
  return (
    <>
      <FieldLabel for="language-selector" class="sr-only">{t("language")}</FieldLabel>
      <Select id="language-selector" title={t("language")} value={props.value} onChange={(event) => props.onChange(event.currentTarget.value)}>
        <option value="es">ES</option>
        <option value="en">EN</option>
      </Select>
    </>
  );
}
