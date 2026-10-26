import { Show } from "solid-js";
import { t } from "../../lib/i18n";
import { prettyJSON, tryFormatJSON } from "../../lib/request-utils";
import { CheckboxField, FormField } from "../../ui/Controls";
import { lazy } from "solid-js";
import { IconButton } from "../../ui/IconButton";
const JsonCodeEditor = lazy(() => import("../../ui/JsonCodeEditor").then((module) => ({ default: module.JsonCodeEditor })));
import { showToast } from "../store";

export function ResponseBodyEditor(props) {
  const format = () => {
    const formatted = tryFormatJSON(props.draft.responseBody);
    if (formatted !== null) props.update("responseBody", formatted);
    else showToast(t("invalidJSONFormat"), "error");
  };

  return (
    <Show when={!(props.draft.blockRequest && props.draft.blockType === "network-fail")}>
      <CheckboxField label={t("replaceResponseBody")} hint={t("preserveResponseBodyHint")} checked={props.draft.overrideBody} onChange={(value) => props.update("overrideBody", value)} />
      <Show when={props.draft.overrideBody}>
      <FormField
        label={t("responseBody")}
        actions={
          <div class="body-editor-actions">
            <IconButton icon="braces" label={t("formatJSON")} onClick={format} />
            <Show when={props.request?.resBody}>
              <IconButton icon="restore" label={t("restoreResponse")} onClick={() => props.update("responseBody", prettyJSON(props.request?.resBody ?? ""))}>
                {t("reset")}
              </IconButton>
            </Show>
          </div>
        }
      >
        {({ id, labelId, describedBy }) => (
          <JsonCodeEditor
            id={id}
            labelId={labelId}
            describedBy={describedBy}
            value={props.draft.responseBody}
            onChange={(value) => props.update("responseBody", value)}
          />
        )}
      </FormField>
      </Show>
    </Show>
  );
}
