import { Show } from "solid-js";
import { prettyJSON } from "../../lib/request-utils";
import { t } from "../../lib/i18n";
import { CollapsibleSection } from "../../ui/CollapsibleSection";
import { CodeBlock } from "./CodeBlock";
import { HeadersTable } from "./HeadersTable";

export function ResponseDetails(props) {
  return (
    <>
      <Show when={props.request.ruleApplied}>
        <p class="response-source-note">{t("capturedResponseNote")}</p>
      </Show>
      <CollapsibleSection title={t(props.request.ruleApplied ? "capturedResponseHeaders" : "responseHeaders")}>
        <HeadersTable headers={props.request.resHeaders} />
      </CollapsibleSection>
      <CollapsibleSection title={t(props.request.ruleApplied ? "capturedResponseBody" : "responseBodySection")}>
        <Show when={props.request.resBody} fallback={<span class="detail-empty-value">{t("noBody")}</span>}>
          <CodeBlock code={prettyJSON(props.request.resBody)} />
        </Show>
      </CollapsibleSection>
    </>
  );
}
