import { For } from "solid-js";
import { t } from "../../lib/i18n";
import { HTTP_METHODS } from "../../lib/request-utils";
import { FieldLabel, Select } from "../../ui/Controls";

export function MethodFilter(props) {
  return (
    <>
      <FieldLabel for="method-filter" class="sr-only">{t("methodFilterTitle")}</FieldLabel>
      <Select
        id="method-filter"
        title={t("methodFilterTitle")}
        value={props.value}
        onChange={(event) => props.onChange(event.currentTarget.value)}
      >
        <option value="">{t("allMethods")}</option>
        <For each={HTTP_METHODS}>{(method) => <option value={method}>{method}</option>}</For>
      </Select>
    </>
  );
}
