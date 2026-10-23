import { createUniqueId, Show, splitProps } from "solid-js";
import { Input } from "./Inputs";

export function CheckboxField(props) {
  const [local, native] = splitProps(props, ["label", "hint", "trailing", "class", "onChange"]);
  const hintId = createUniqueId();

  return (
    <>
      <label class={`toggle-label${local.class ? ` ${local.class}` : ""}`}>
        <Input
          {...native}
          type="checkbox"
          aria-describedby={local.hint ? hintId : undefined}
          onChange={(event) => local.onChange?.(event.currentTarget.checked, event)}
        />
        <span>{local.label}</span>
        {local.trailing}
      </label>
      <Show when={local.hint}><div id={hintId} class="form-hint">{local.hint}</div></Show>
    </>
  );
}
