import { For, Show } from "solid-js";
import { t } from "../../lib/i18n";
import { Icon } from "../../ui/Icon";

export function RuleDiagnostics(props) {
  return (
    <details class="rule-diag" open={props.diag.open}>
      <summary>{props.diag.summary}</summary>
      <p class="diag-hint">{props.diag.hint}</p>
      <Show when={props.diag.rows.length > 0}>
        <table class="diag-table">
          <tbody>
            <For each={props.diag.rows}>
              {(row) => (
                <tr>
                  <td class={`diag-icon ${row.ok ? "pass" : "fail"}`}>
                    <Icon name={row.ok ? "circle-check" : "circle-x"} />
                    <span class="sr-only">{row.ok ? t("diagnosticPass") : t("diagnosticFail")}</span>
                  </td>
                  <td class="diag-label">{row.label}</td>
                  <td class="diag-value">
                    {row.value}
                    <Show when={row.actual}><span class="diag-actual">({row.actual})</span></Show>
                  </td>
                </tr>
              )}
            </For>
          </tbody>
        </table>
      </Show>
    </details>
  );
}
