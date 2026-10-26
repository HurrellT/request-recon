import { Show } from "solid-js";
import { t } from "../lib/i18n";
import logoUrl from "../../assets/request-recon-logo-sm.png";

export function PopupHeader(props) {
  return (
    <header class="popup-header">
      <img class="popup-brand-icon" src={logoUrl} width="28" height="28" alt="" />
      <h1 class="popup-title">Request Recon</h1>
      <Show when={props.activeCount > 0}>
        <span class="popup-active-count">{t("activeRules", { count: props.activeCount })}</span>
      </Show>
    </header>
  );
}
