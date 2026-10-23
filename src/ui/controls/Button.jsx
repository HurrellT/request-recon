import { splitProps } from "solid-js";

export function Button(props) {
  const [local, native] = splitProps(props, ["variant", "class", "classList", "children"]);
  const className = () => [local.variant && `btn btn-${local.variant}`, local.class].filter(Boolean).join(" ");

  return (
    <button
      {...native}
      type={native.type ?? "button"}
      class={className()}
      classList={local.classList}
    >
      {local.children}
    </button>
  );
}
