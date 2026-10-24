import { Show } from "solid-js";
import { t } from "../../lib/i18n";
import { Button, CheckboxField } from "../../ui/Controls";

export function RuleActions(props) {
  return (
    <div class="rule-actions">
      <Show when={props.ruleId} fallback={<span />}>
        <CheckboxField label={t("enableRule")} checked={props.enabled} onChange={props.onEnabledChange} />
      </Show>
      <div class="btn-group">
        <Show when={props.ruleId}>
          <Button variant="danger" onClick={props.onDelete}>{t("delete")}</Button>
        </Show>
        <Button variant="primary" onClick={props.onSave}>{props.ruleId ? t("updateRule") : t("saveRule")}</Button>
      </div>
    </div>
  );
}
