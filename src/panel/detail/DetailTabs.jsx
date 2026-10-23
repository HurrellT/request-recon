import { For } from "solid-js";
import { t } from "../../lib/i18n";
import { Button } from "../../ui/Controls";

const REQUEST_TABS = ["request", "response", "rule"];

export function DetailTabs(props) {
  const tabs = () => props.hasRequest ? REQUEST_TABS : ["rule"];
  const label = (tab) => t(`${tab}Tab`);
  const onKeyDown = (event) => {
    const index = tabs().indexOf(props.activeTab);
    let next;
    if (event.key === "ArrowRight") next = (index + 1) % tabs().length;
    else if (event.key === "ArrowLeft") next = (index - 1 + tabs().length) % tabs().length;
    else if (event.key === "Home") next = 0;
    else if (event.key === "End") next = tabs().length - 1;
    else return;
    event.preventDefault();
    const tab = tabs()[next];
    props.onChange(tab);
    event.currentTarget.querySelector(`#detail-tab-${tab}`)?.focus();
  };

  return (
    <div id="tab-bar" role="tablist" aria-label={t("requestDetailsTabs")} onKeyDown={onKeyDown}>
      <For each={tabs()}>
        {(tab) => (
          <Button
            id={`detail-tab-${tab}`}
            role="tab"
            class="tab-btn"
            classList={{ active: props.activeTab === tab }}
            aria-selected={props.activeTab === tab}
            aria-controls="tab-content"
            tabindex={props.activeTab === tab ? 0 : -1}
            onClick={() => props.onChange(tab)}
          >
            {label(tab)}
          </Button>
        )}
      </For>
    </div>
  );
}
