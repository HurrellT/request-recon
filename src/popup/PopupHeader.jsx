import { Show } from "solid-js";
import { t } from "../lib/i18n";
import { Icon } from "../ui/Icon";

export function PopupHeader(props) {
  return (
    <header class="popup-header">
      <span class="popup-brand-icon"><Icon name="bolt" /></span>
      <h1 class="popup-title">Request Recon</h1>
      <Show when={props.activeCount > 0}>
        <span class="popup-active-count">{t("activeRules", { count: props.activeCount })}</span>
      </Show>
    </header>
  );
}
