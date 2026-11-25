import { omit } from "solid-js";
import { Input } from "./Inputs";

export function ToggleSwitch(props) {
  const native = omit(props, "label", "onChange", "onClick", "class");

  return (
    <label class={["toggle-switch", props.class]} title={props.label} onClick={props.onClick}>
      <Input
        {...native}
        type="checkbox"
        aria-label={props.label}
        onChange={(event) => props.onChange?.(event.currentTarget.checked, event)}
      />
      <span class="toggle-slider" aria-hidden="true" />
    </label>
  );
}
