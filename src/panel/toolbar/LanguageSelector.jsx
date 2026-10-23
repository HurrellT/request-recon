import { t } from "../../lib/i18n";

export function LanguageSelector(props) {
  return (
    <>
      <label for="language-selector" class="sr-only">{t("language")}</label>
      <select id="language-selector" title={t("language")} value={props.value} onChange={(event) => props.onChange(event.currentTarget.value)}>
        <option value="es">ES</option>
        <option value="en">EN</option>
      </select>
    </>
  );
}
