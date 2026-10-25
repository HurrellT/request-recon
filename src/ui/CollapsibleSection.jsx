import { createSignal, createUniqueId } from "solid-js";
import { Icon } from "./Icon";
import { Button } from "./Controls";

export function CollapsibleSection(props) {
  const [collapsed, setCollapsed] = createSignal(props.defaultCollapsed ?? false);
  const bodyId = createUniqueId();

  return (
    <section class="section" classList={{ collapsed: collapsed() }}>
      <h3 class="section-heading">
        <Button
          class="section-header"
          aria-expanded={!collapsed()}
          aria-controls={bodyId}
          onClick={() => setCollapsed((value) => !value)}
        >
          <span>{props.title}</span>
          <Icon name="chevron-down" class="section-toggle" />
        </Button>
      </h3>
      <div id={bodyId} class="section-body" hidden={collapsed()}>{props.children}</div>
    </section>
  );
}
