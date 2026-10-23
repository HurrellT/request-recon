import { splitProps } from "solid-js";
import { Input } from "./Inputs";

export function ToggleSwitch(props) {
  const [local, native] = splitProps(props, ["label", "onChange", "onClick", "class"]);

  return (
    <label class={`toggle-switch${local.class ? ` ${local.class}` : ""}`} title={local.label} onClick={local.onClick}>
      <Input
        {...native}
        type="checkbox"
        aria-label={local.label}
        onChange={(event) => local.onChange?.(event.currentTarget.checked, event)}
      />
      <span class="toggle-slider" aria-hidden="true" />
    </label>
  );
}
