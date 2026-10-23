export function EmptyState(props) {
  return (
    <div class={`empty-state${props.class ? ` ${props.class}` : ""}`}>
      <div>{props.title}</div>
      {props.children && <p>{props.children}</p>}
      {props.action}
    </div>
  );
}
