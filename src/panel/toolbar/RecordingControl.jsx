import { t } from "../../lib/i18n";

export function RecordingControl(props) {
  return (
    <button
      type="button"
      id="record-btn"
      classList={{ active: props.recording }}
      aria-pressed={props.recording}
      title={t("recordTitle")}
      onClick={props.onToggle}
    >
      <span id="record-dot" aria-hidden="true" />
      <span id="record-label">{props.recording ? t("stop") : t("start")}</span>
    </button>
  );
}
