import { Show } from "solid-js";
import { prettyJSON } from "../../lib/request-utils";
import { t } from "../../lib/i18n";
import { CollapsibleSection } from "../../ui/CollapsibleSection";
import { JsonCodeEditor } from "../../ui/JsonCodeEditor";
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
          <JsonCodeEditor
            value={prettyJSON(props.request.resBody)}
            ariaLabel={t(props.request.ruleApplied ? "capturedResponseBody" : "responseBodySection")}
            readOnly
          />
        </Show>
      </CollapsibleSection>
      <CollapsibleSection title={t(props.request.ruleApplied ? "capturedResponseBodyRaw" : "responseBodyRawSection")} defaultCollapsed>
        <Show when={props.request.resBody} fallback={<span class="detail-empty-value">{t("noBody")}</span>}>
          <CodeBlock code={props.request.resBody} />
        </Show>
      </CollapsibleSection>
    </>
  );
}
