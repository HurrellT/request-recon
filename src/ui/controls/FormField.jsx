import { createUniqueId, Show } from "solid-js";
import { FieldLabel } from "./FieldLabel";

export function FormField(props) {
  const id = createUniqueId();
  const hintId = `${id}-hint`;

  return (
    <div class={`form-group${props.class ? ` ${props.class}` : ""}`}>
      <div classList={{ "body-header": !!props.actions }}>
        <FieldLabel for={id} class="form-label" note={props.note}>{props.label}</FieldLabel>
        {props.actions}
      </div>
      {props.children({ id, describedBy: props.hint ? hintId : undefined })}
      <Show when={props.hint}>
        <div id={hintId} class="form-hint">{props.hint}</div>
      </Show>
    </div>
  );
}
