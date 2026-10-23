import { Show } from "solid-js";
import { prettyJSON } from "../../lib/request-utils";
import { t } from "../../lib/i18n";
import { CodeBlock } from "./CodeBlock";

export function GraphQLDetails(props) {
  return (
    <div class="graphql-details">
      <Show when={props.graphql.operationName}>
        <div class="graphql-operation">
          <span>{t("operation")}</span>
          <strong>{props.graphql.operationName}</strong>
        </div>
      </Show>
      <Show when={props.graphql.query}>
        <CodeBlock code={props.graphql.query} />
      </Show>
      <Show when={props.graphql.variables}>
        <div class="graphql-variables-label">{t("variables")}</div>
        <CodeBlock code={prettyJSON(JSON.stringify(props.graphql.variables))} />
      </Show>
    </div>
  );
}
