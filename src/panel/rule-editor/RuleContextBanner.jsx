import { Match, Show, Switch } from "solid-js";
import { t } from "../../lib/i18n";
import { Icon } from "../../ui/Icon";

export function RuleContextBanner(props) {
  return (
    <Show when={props.request}>
      <Switch>
        <Match when={props.intercepted}><div class="rule-banner intercepted"><Icon name="bolt" />{t("interceptedBanner")}</div></Match>
        <Match when={props.rule}><div class="rule-banner pending"><Icon name="clock" />{t("pendingBanner")}</div></Match>
        <Match when={true}><div class="rule-banner new-rule"><Icon name="pencil" />{t("newRuleBanner")}</div></Match>
      </Switch>
    </Show>
  );
}
