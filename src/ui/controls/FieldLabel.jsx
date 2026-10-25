import { Show } from "solid-js";

export function FieldLabel(props) {
  return (
    <label id={props.id} for={props.for} class={props.class}>
      {props.children}
      <Show when={props.note}> <span class="form-label-note">{props.note}</span></Show>
    </label>
  );
}
