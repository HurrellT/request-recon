import { createUniqueId, omit, Show } from "solid-js";
import { Input } from "./Inputs";

export function CheckboxField(props) {
  const native = omit(props, "label", "hint", "trailing", "class", "onChange");
  const hintId = createUniqueId();

  return (
    <>
      <label class={["toggle-label", props.class]}>
        <Input
          {...native}
          type="checkbox"
          aria-describedby={props.hint ? hintId : undefined}
          onChange={(event) => props.onChange?.(event.currentTarget.checked, event)}
        />
        <span>{props.label}</span>
        {props.trailing}
      </label>
      <Show when={props.hint}><div id={hintId} class="form-hint">{props.hint}</div></Show>
    </>
  );
}
