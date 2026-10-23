import { createMemo, For, Show } from "solid-js";
import { headersToEntries } from "../../lib/request-utils";
import { t } from "../../lib/i18n";

export function HeadersTable(props) {
  const entries = createMemo(() => headersToEntries(props.headers));
  return (
    <Show when={entries().length > 0} fallback={<span class="detail-empty-value">{t("noHeaders")}</span>}>
      <dl class="headers-grid">
        <For each={entries()}>
          {([key, value]) => (
            <>
              <dt class="header-name">{key}</dt>
              <dd class="header-value">{value}</dd>
            </>
          )}
        </For>
      </dl>
    </Show>
  );
}
