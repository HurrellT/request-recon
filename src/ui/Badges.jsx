import { methodCSSClass, statusBadgeClass } from "../lib/request-utils";

export function MethodBadge(props) {
  return (
    <span class={`${props.detail ? "detail-method" : "method-badge"} ${methodCSSClass(props.method)}${props.class ? ` ${props.class}` : ""}`}>
      {props.method}
    </span>
  );
}

export function StatusBadge(props) {
  return (
    <span class={`status-badge ${props.tone ?? statusBadgeClass(props.status)}${props.class ? ` ${props.class}` : ""}`}>
      {props.status}
    </span>
  );
}
