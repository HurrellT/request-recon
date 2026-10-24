import { createEffect, createSignal, on, onCleanup } from "solid-js";
import { t } from "../../lib/i18n";
import { ruleMatchesRequest } from "../../lib/request-utils";
import {
  directEditRule,
  requests,
  rules,
  selectedRequest,
  send,
  setActiveTab,
  setDirectEditRule,
  setSelectedId,
  setShowRulesSidebar,
  showRulesSidebar,
  showToast,
} from "../store";
import { parseRulesFile } from "./import-rules";
import { RuleList } from "./RuleList";
import { SidebarHeader } from "./SidebarHeader";

const overlayWidth = "(max-width: 980px)";

export function RulesSidebar() {
  const media = window.matchMedia(overlayWidth);
  const [overlay, setOverlay] = createSignal(media.matches);
  const updateOverlay = () => setOverlay(media.matches);
  media.addEventListener("change", updateOverlay);
  onCleanup(() => media.removeEventListener("change", updateOverlay));

  const close = (restoreFocus = true) => {
    setShowRulesSidebar(false);
    if (restoreFocus) queueMicrotask(() => document.getElementById("rules-toggle-btn")?.focus());
  };

  createEffect(on([showRulesSidebar, overlay], ([open, isOverlay]) => {
    if (open && isOverlay) {
      queueMicrotask(() => document.querySelector("#rules-sidebar .sidebar-close-btn")?.focus());
    }
  }));

  createEffect(() => {
    const modal = showRulesSidebar() && overlay();
    const regions = ["toolbar", "request-list-panel", "detail-panel"].map((id) => document.getElementById(id));
    for (const region of regions) if (region) region.inert = modal;
    onCleanup(() => {
      for (const region of regions) if (region) region.inert = false;
    });
  });

  const edit = (rule) => {
    const matchingRequest = [...requests()].reverse().find((request) => ruleMatchesRequest(rule, request));
    if (matchingRequest) {
      setDirectEditRule(null);
      setSelectedId(matchingRequest.id);
    } else {
      setDirectEditRule(rule);
      setSelectedId(null);
    }
    setActiveTab("rule");
    if (overlay()) close(false);
    queueMicrotask(() => document.getElementById("detail-tab-rule")?.focus());
  };

  const toggle = (rule, enabled) => send({ type: "TOGGLE_RULE", ruleId: rule.id, enabled });

  const remove = (rule, event) => {
    const row = event.currentTarget.closest(".rule-item");
    const nextFocus = row?.nextElementSibling?.querySelector(".rule-edit-btn")
      ?? row?.previousElementSibling?.querySelector(".rule-edit-btn")
      ?? document.querySelector("#rules-sidebar .sidebar-close-btn");
    nextFocus?.focus();
    send({ type: "DELETE_RULE", ruleId: rule.id });
    if (directEditRule()?.id === rule.id) setDirectEditRule(null);
    showToast(t("ruleDeleted"), "success");
  };

  const importFile = async (file) => {
    try {
      const imported = parseRulesFile(await file.text());
      send({ type: "IMPORT_RULES", rules: imported });
      showToast(t("importedRules", { count: imported.length }), "success");
    } catch (_) {
      showToast(t("invalidRulesImport"), "error");
    }
  };

  const handleKeyDown = (event) => {
    if (event.key === "Escape") {
      event.preventDefault();
      close();
      return;
    }
    if (event.key !== "Tab" || !overlay()) return;

    const controls = [...event.currentTarget.querySelectorAll('button:not([disabled]), input:not([disabled]):not([hidden])')];
    const first = controls[0];
    const last = controls.at(-1);
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last?.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first?.focus();
    }
  };

  return (
    <>
      <div class="rules-sidebar-backdrop" classList={{ open: overlay() && showRulesSidebar() }} aria-hidden="true" onPointerDown={() => close()} />
      <aside
        id="rules-sidebar"
        classList={{ open: showRulesSidebar() }}
        role={overlay() && showRulesSidebar() ? "dialog" : undefined}
        aria-modal={overlay() && showRulesSidebar() ? "true" : undefined}
        aria-labelledby="rules-sidebar-heading"
        aria-hidden={!showRulesSidebar()}
        inert={!showRulesSidebar()}
        onKeyDown={handleKeyDown}
      >
        <SidebarHeader count={rules().length} onExport={() => send({ type: "EXPORT_RULES" })} onImport={importFile} onClose={() => close()} />
        <RuleList rules={rules()} selectedRuleId={directEditRule()?.id ?? selectedRequest()?.ruleId} onEdit={edit} onToggle={toggle} onDelete={remove} />
      </aside>
    </>
  );
}
