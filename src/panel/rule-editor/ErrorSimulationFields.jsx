import { For, Show } from "solid-js";
import { t } from "../../lib/i18n";
import { CheckboxField, FormField, Select } from "../../ui/Controls";

const ERROR_STATUSES = [
  [400, "400 Bad Request"],
  [401, "401 Unauthorized"],
  [403, "403 Forbidden"],
  [404, "404 Not Found"],
  [429, "429 Too Many Requests"],
  [500, "500 Internal Server Error"],
  [502, "502 Bad Gateway"],
  [503, "503 Service Unavailable"],
  [504, "504 Gateway Timeout"],
];

export function ErrorSimulationFields(props) {
  const { draft, update } = props;

  return (
    <>
      <div class="form-group">
        <CheckboxField
          label={t("simulateError")}
          hint={t("simulateErrorHint")}
          checked={draft.blockRequest}
          onChange={(checked) => {
            update("blockRequest", checked);
            props.applyBlockDefaults(checked);
          }}
        />
      </div>

      <Show when={draft.blockRequest}>
        <div class="form-row">
          <FormField label={t("errorType")}>
            {({ id }) => (
              <Select id={id} variant="form" value={draft.blockType} onChange={(event) => {
                update("blockType", event.currentTarget.value);
                props.applyBlockDefaults(draft.blockRequest, event.currentTarget.value);
              }}>
                <option value="http-error">{t("httpError")}</option>
                <option value="network-fail">{t("networkError")}</option>
              </Select>
            )}
          </FormField>
          <Show when={draft.blockType !== "network-fail"}>
            <FormField label={t("statusCode")}>
              {({ id }) => (
                <Select id={id} variant="form" value={draft.blockStatus} onChange={(event) => props.updateBlockStatus(event.currentTarget.value)}>
                  <For each={ERROR_STATUSES}>{([value, label]) => <option value={value}>{label}</option>}</For>
                </Select>
              )}
            </FormField>
          </Show>
        </div>
      </Show>
    </>
  );
}
