import { omit } from "solid-js";

export function Button(props) {
  const native = omit(props, "variant", "class", "children", "type");

  return (
    <button
      {...native}
      type={props.type ?? "button"}
      class={[props.variant && `btn btn-${props.variant}`, props.class]}
    >
      {props.children}
    </button>
  );
}
