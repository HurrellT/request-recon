import { createEffect, omit } from "solid-js";

const controlClass = (variant, className, kind) => [variant === "form" && `form-${kind}`, className];

export function Input(props) {
  const native = omit(props, "variant", "class");
  return <input {...native} class={controlClass(props.variant, props.class, "input")} />;
}

export function Select(props) {
  const native = omit(props, "variant", "class", "children", "value");
  let element;
  createEffect(() => props.value, (value) => {
    if (element && value != null) element.value = String(value);
  });
  return <select {...native} ref={element} class={controlClass(props.variant, props.class, "select")}>{props.children}</select>;
}

export function TextArea(props) {
  const native = omit(props, "variant", "class");
  return <textarea {...native} class={controlClass(props.variant, props.class, "textarea")} />;
}
