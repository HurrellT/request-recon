import { splitProps } from "solid-js";
import { Icon } from "./Icon";
import { Button } from "./Controls";

export function IconButton(props) {
  const [local, buttonProps] = splitProps(props, ["icon", "label", "title", "class", "children"]);

  return (
    <Button
      {...buttonProps}
      class={`btn-icon${local.class ? ` ${local.class}` : ""}`}
      aria-label={local.label}
      title={local.title ?? local.label}
    >
      <Icon name={local.icon} />
      {local.children}
    </Button>
  );
}
