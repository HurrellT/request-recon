import { createSignal, createUniqueId } from "solid-js";
import { Icon } from "./Icon";

export function CollapsibleSection(props) {
  const [collapsed, setCollapsed] = createSignal(false);
  const bodyId = createUniqueId();

  return (
    <section class="section" classList={{ collapsed: collapsed() }}>
      <h3 class="section-heading">
        <button
          type="button"
          class="section-header"
          aria-expanded={!collapsed()}
          aria-controls={bodyId}
          onClick={() => setCollapsed((value) => !value)}
        >
          <span>{props.title}</span>
          <Icon name="chevron-down" class="section-toggle" />
        </button>
      </h3>
      <div id={bodyId} class="section-body" hidden={collapsed()}>{props.children}</div>
    </section>
  );
}
