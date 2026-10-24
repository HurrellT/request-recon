import { createEffect, splitProps } from "solid-js";

const controlClass = (variant, className, kind) => [variant === "form" && `form-${kind}`, className].filter(Boolean).join(" ");

export function Input(props) {
  const [local, native] = splitProps(props, ["variant", "class"]);
  return <input {...native} class={controlClass(local.variant, local.class, "input")} />;
}

export function Select(props) {
  const [local, native] = splitProps(props, ["variant", "class", "children", "value"]);
  let element;
  createEffect(() => {
    if (element && local.value != null) element.value = String(local.value);
  });
  return <select {...native} ref={element} class={controlClass(local.variant, local.class, "select")}>{local.children}</select>;
}

export function TextArea(props) {
  const [local, native] = splitProps(props, ["variant", "class"]);
  return <textarea {...native} class={controlClass(local.variant, local.class, "textarea")} />;
}
