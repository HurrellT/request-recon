import { Show } from "solid-js";
import { chooseLanguage, language, t } from "../lib/i18n";
import { Button, FieldLabel, Select } from "../ui/Controls";

export function PopupFooter(props) {
  return (
    <footer class="popup-footer">
      <Show when={props.hasRules}>
        <Button variant="secondary" class="popup-toggle-all" onClick={props.onToggleAll} disabled={props.busy}>
          {props.anyActive ? t("disableAll") : t("enableAll")}
        </Button>
        <p class="popup-footer-hint">{t("popupFooter")}</p>
      </Show>
      <Show when={props.sessionCount > 0}>
        <Button variant="secondary" onClick={props.onStopCapture} disabled={props.busy}>{t("stopAllCapture", { count: props.sessionCount })}</Button>
      </Show>
      <div class="popup-language">
        <FieldLabel for="popup-language">{t("language")}</FieldLabel>
        <Select id="popup-language" value={language()} onChange={(event) => chooseLanguage(event.currentTarget.value)}>
          <option value="es">Español</option>
          <option value="en">English</option>
        </Select>
      </div>
    </footer>
  );
}
