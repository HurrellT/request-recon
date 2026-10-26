import { lazy, Show } from "solid-js";
import { prettyJSON } from "../../lib/request-utils";
import { t } from "../../lib/i18n";
import { CollapsibleSection } from "../../ui/CollapsibleSection";
const JsonCodeEditor = lazy(() => import("../../ui/JsonCodeEditor").then((module) => ({ default: module.JsonCodeEditor })));
import { CodeBlock } from "./CodeBlock";
import { HeadersTable } from "./HeadersTable";

export function ResponseDetails(props) {
  return (
    <>
      <Show when={props.request.ruleApplied}>
        <p class="response-source-note">{t("capturedResponseNote")}</p>
      </Show>
      <Show when={props.request.responseErrorReason}><p class="response-source-note">{props.request.responseErrorReason}</p></Show>
      <Show when={props.request.bodyUnavailable && props.request.bodyUnavailable !== "empty"}>
        <p class="response-source-note">{t(`bodyUnavailable_${props.request.bodyUnavailable}`)}</p>
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
