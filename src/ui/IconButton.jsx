import { splitProps } from "solid-js";
import { Icon } from "./Icon";

export function IconButton(props) {
  const [local, buttonProps] = splitProps(props, ["icon", "label", "title", "class", "children"]);

  return (
    <button
      {...buttonProps}
      type={buttonProps.type ?? "button"}
      class={`btn-icon${local.class ? ` ${local.class}` : ""}`}
      aria-label={local.label}
      title={local.title ?? local.label}
    >
      <Icon name={local.icon} />
      {local.children}
    </button>
  );
}
