import { Show } from "solid-js";
import { t } from "../../lib/i18n";
import { prettyJSON, tryFormatJSON } from "../../lib/request-utils";
import { FormField, TextArea } from "../../ui/Controls";
import { IconButton } from "../../ui/IconButton";
import { showToast } from "../store";

export function ResponseBodyEditor(props) {
  const format = () => {
    const formatted = tryFormatJSON(props.draft.responseBody);
    if (formatted !== null) props.update("responseBody", formatted);
    else showToast(t("invalidJSONFormat"), "error");
  };

  return (
    <Show when={!(props.draft.blockRequest && props.draft.blockType === "network-fail")}>
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
        {({ id }) => <TextArea id={id} variant="form" rows="12" spellcheck={false} value={props.draft.responseBody} onInput={(event) => props.update("responseBody", event.currentTarget.value)} />}
      </FormField>
    </Show>
  );
}
