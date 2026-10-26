import { For, Show } from "solid-js";
import { t } from "../../lib/i18n";
import { HTTP_METHODS } from "../../lib/request-utils";
import { FormField, Input, Select } from "../../ui/Controls";

export function RuleMatchFields(props) {
  const { draft, update } = props;

  return (
    <>
      <FormField label={t("name")} note={t("freeLabel")}>
        {({ id }) => <Input id={id} variant="form" type="text" placeholder={t("namePlaceholder")} value={draft.name} onInput={(event) => update("name", event.currentTarget.value)} />}
      </FormField>

      <FormField label={draft.url && !draft.urlPattern ? t("exactURL") : t("urlPattern")} note={draft.url && !draft.urlPattern ? "" : "(RE2)"} hint={t("safeRegexHint")}>
        {({ id, describedBy }) => <Input id={id} aria-describedby={describedBy} variant="form" type="text" spellcheck={false} value={draft.urlPattern || draft.url} onInput={(event) => {
          if (draft.url && !draft.urlPattern) update("url", event.currentTarget.value);
          else update("urlPattern", event.currentTarget.value);
        }} />}
      </FormField>

      <div class="form-row">
        <FormField label={t("httpMethod")}>
          {({ id }) => (
            <Select id={id} variant="form" value={draft.method} onChange={(event) => update("method", event.currentTarget.value)}>
              <option value="*">{t("anyMethod")}</option>
              <For each={HTTP_METHODS}>{(method) => <option value={method}>{method}</option>}</For>
            </Select>
          )}
        </FormField>
        <FormField label={t("statusCode")} hint={t("preserveStatusHint")}>
          {({ id, describedBy }) => <Input id={id} aria-describedby={describedBy} variant="form" type="number" min="200" max="599" value={draft.statusCode} onInput={(event) => update("statusCode", event.currentTarget.value)} />}
        </FormField>
      </div>

      <Show when={props.showGraphQL}>
        <FormField label={t("graphqlOperation")} hint={<>{t("example")} <code>GetUser</code>, <code>CreateOrder</code></>}>
          {({ id, describedBy }) => <Input id={id} aria-describedby={describedBy} variant="form" type="text" placeholder={t("operationPlaceholder")} value={draft.operationName} onInput={(event) => update("operationName", event.currentTarget.value)} />}
        </FormField>
      </Show>

      <FormField label={t("bodyContains")} note={t("optional")} hint={t("bodyContainsHint")}>
        {({ id, describedBy }) => <Input id={id} aria-describedby={describedBy} variant="form" type="text" spellcheck={false} placeholder={t("bodyContainsPlaceholder")} value={draft.bodyContains} onInput={(event) => update("bodyContains", event.currentTarget.value)} />}
      </FormField>
    </>
  );
}
