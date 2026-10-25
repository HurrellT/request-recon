import { createUniqueId, Show } from "solid-js";
import { FieldLabel } from "./FieldLabel";

export function FormField(props) {
  const id = createUniqueId();
  const labelId = `${id}-label`;
  const hintId = `${id}-hint`;

  return (
    <div class={`form-group${props.class ? ` ${props.class}` : ""}`}>
      <div classList={{ "body-header": !!props.actions }}>
        <FieldLabel id={labelId} for={id} class="form-label" note={props.note}>{props.label}</FieldLabel>
        {props.actions}
      </div>
      {props.children({ id, labelId, describedBy: props.hint ? hintId : undefined })}
      <Show when={props.hint}>
        <div id={hintId} class="form-hint">{props.hint}</div>
      </Show>
    </div>
  );
}
