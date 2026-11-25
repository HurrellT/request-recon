import { omit } from "solid-js";
import { Icon } from "./Icon";
import { Button } from "./Controls";

export function IconButton(props) {
  const buttonProps = omit(props, "icon", "label", "title", "class", "children");

  return (
    <Button
      {...buttonProps}
      class={["btn-icon", props.class]}
      aria-label={props.label}
      title={props.title ?? props.label}
    >
      <Icon name={props.icon} />
      {props.children}
    </Button>
  );
}
