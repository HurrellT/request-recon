import { t } from "../lib/i18n";

export function DonationLink() {
  return (
    <a
      class="donation-link"
      href="https://ko-fi.com/hurrellt"
      target="_blank"
      rel="noopener noreferrer"
      title={t("donateCoffeeTitle")}
    >
      <span aria-hidden="true">☕</span>
      <span>{t("donateCoffee")}</span>
    </a>
  );
}
