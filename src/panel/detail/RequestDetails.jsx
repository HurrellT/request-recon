import { Show } from "solid-js";
import { prettyJSON } from "../../lib/request-utils";
import { t } from "../../lib/i18n";
import { CollapsibleSection } from "../../ui/CollapsibleSection";
import { CodeBlock } from "./CodeBlock";
import { GraphQLDetails } from "./GraphQLDetails";
import { HeadersTable } from "./HeadersTable";

export function RequestDetails(props) {
  return (
    <>
      <CollapsibleSection title={t("requestHeaders")}>
        <HeadersTable headers={props.request.reqHeaders} />
      </CollapsibleSection>
      <Show when={props.request.reqBody?.trim()}>
        <CollapsibleSection title={t("requestBody")}>
          <CodeBlock code={prettyJSON(props.request.reqBody)} />
        </CollapsibleSection>
      </Show>
      <Show when={props.request.graphql}>
        {(graphql) => (
          <CollapsibleSection title="GraphQL">
            <GraphQLDetails graphql={graphql()} />
          </CollapsibleSection>
        )}
      </Show>
    </>
  );
}
