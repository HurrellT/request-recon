import { t } from "../../lib/i18n";

export function RequestListHeader(props) {
  return (
    <header id="request-list-header">
      <h2 class="request-list-heading">{t("requests")}</h2>
      <span
        id="request-count"
        title={t("visibleMatchesTitle")}
        aria-label={`${t("visibleMatchesTitle")}: ${props.visibleCount}/${props.matchingCount}`}
      >
        {props.visibleCount}/{props.matchingCount}
      </span>
    </header>
  );
}
