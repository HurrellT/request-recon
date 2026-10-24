export function Toast(props) {
  return (
    <div class="app-toast" classList={{ show: !!props.toast, success: props.toast?.type === "success", error: props.toast?.type === "error" }}>
      <span role="status" aria-atomic="true">{props.toast?.type !== "error" ? props.toast?.message : ""}</span>
      <span role="alert" aria-atomic="true">{props.toast?.type === "error" ? props.toast.message : ""}</span>
    </div>
  );
}
