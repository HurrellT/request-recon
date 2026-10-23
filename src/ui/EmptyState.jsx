export function EmptyState(props) {
  return (
    <div class={`empty-state${props.class ? ` ${props.class}` : ""}`}>
      <div>{props.title}</div>
      {props.action}
      {props.children && <p>{props.children}</p>}
    </div>
  );
}
