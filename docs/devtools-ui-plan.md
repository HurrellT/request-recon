# DevTools UI review and component plan

Status: **sections 1–3 committed by the user; section 4 implemented and awaiting review; sections 5–7 pending**. MPL 2.0 covers the core; Tabler Icons are the UI icon family. Branch: `codex/devtools-ui-components`.

## Current shape

- At planning time, the DevTools UI was concentrated in `src/panel/main.jsx` (819 lines) and `src/panel/panel.css` (934 lines). Section 2 extracts the toolbar controls and their styles from those files.
- `src/panel/store.js` holds shared panel state; `src/panel/usePort.js` handles the DevTools connection and also injects a notification into the inspected page.
- The extension popup has its own rule list and styles. It is a separate surface, but its method badge and rule toggle are candidates for reuse.
- The original UI used inconsistent visual symbols. Section 1 replaced them with Tabler Icons in the panel and inspected-page notification.
- Baseline on this branch: `npm test` passes (6 tests); `npm run build` succeeds.

## Icon choice and license handling

**Chosen family: Tabler Icons, outline style.** It has a coherent 24 px grid and covers the actions and states in this UI. Use a small, explicit set of locally bundled SVGs through one `Icon` component; use a consistent 16 px default, 2 px stroke, `currentColor`, and size variants only where needed. Icons supplement clear text and status colors.

Tabler is free for personal and commercial use under MIT. Its license requires retaining the copyright and license notice with copies or substantial portions. Keep Tabler's icon files and license identity separate from Request Recon's MPL-covered source. The exact Tabler copyright and MIT license text are in `THIRD_PARTY_NOTICES.txt`; `vite.config.js` bundles that notice and `LICENSE` into the extension. Verify the built `dist/` output after section 1 and each icon upgrade. UI attribution is optional.

Icon mapping: intercepted/active rule → bolt; pending rule → clock; blocked request → ban; diagnostic pass/fail → circle-check/circle-x; expand → chevron-down; close/delete → x/trash; format JSON → braces; restore → restore; import/export → upload/download; empty request detail → file-description. Section 2 adds search, filter, and list-details icons to the toolbar. Keep the recording dot as a status indicator, not an icon.

## Reviewable work sections

Each section is a separate review stop. Keep changes uncommitted. Preserve request capture, filtering, rule behavior, persisted storage, and English/Spanish translations while changing presentation.

| Section | Current issues and improvement study | Proposed component boundary | Review check |
| --- | --- | --- | --- |
| 1. Shared visual foundation | Mixed glyphs, repeated button and badge rules, weak keyboard focus styling. | `Icon`, `IconButton`, `MethodBadge`, `StatusBadge`, `EmptyState`, `CollapsibleSection`, shared tokens/styles. Replace symbols in the panel and inspected-page notification using the same approved artwork. | One icon family and consistent sizes; icon-only controls have accessible names; focus is visible. |
| 2. Toolbar and traffic controls | Recording, clear, search, method, traffic, rules, and language compete in one tight row; narrow DevTools widths have no responsive treatment. | `PanelToolbar` with `RecordingControl`, `RequestSearch`, `MethodFilter`, `TrafficFilterMenu`, `RulesToggle`, `LanguageSelector`. Keep filter state in the existing store. | Controls remain usable at narrow and wide panel widths; traffic counts and persisted visibility remain correct. |
| 3. Request list | Row states rely on tiny glyphs and color; row is a clickable `div`; empty state combines several conditions. | `RequestList`, `RequestListHeader`, `RequestRow`, `RequestListEmptyState`, and a focused rule-state indicator. | Keyboard selection works; selected, intercepted, pending, failed, and hidden states are distinguishable; visible/total count keeps its meaning. |
| 4. Detail header and request/response tabs | Header and tabs are embedded in the root file; long headers and bodies need clearer scanning. Captured upstream headers/body must be distinguished from the applied response outcome introduced in section 3. | `RequestDetail`, `DetailHeader`, `DetailTabs`, `RequestDetails`, `ResponseDetails`, `HeadersTable`, `CodeBlock`, `GraphQLDetails`, accessible `CollapsibleSection`. | Tab and disclosure keyboard behavior works; original versus applied response data is clear; long URLs, header values, JSON, and GraphQL remain readable. |
| 5. Rule editor and diagnostics | One component owns draft initialization, matching fields, error simulation, response editing, save/delete, and diagnostics; labels are not consistently bound to inputs. | `RuleEditor` plus `RuleMatchFields`, `ErrorSimulationFields`, `ResponseBodyEditor`, `RuleActions`, `RuleDiagnostics`; extract draft and diagnostic logic into small pure helpers where useful. | Existing rule edit, create, enable, block modes, format/reset, save/delete, and diagnostics behave the same; drafts are not unexpectedly reset. |
| 6. Saved-rules sidebar | Fixed 320 px width crowds the detail pane; actions use text substitutes; rule row is another clickable `div`; toggle and delete behavior is nested inside it. | `RulesSidebar`, `SidebarHeader`, `RuleList`, `RuleListItem`, `RuleImportExportActions`; reuse badges, toggle, empty state, and icon button where they genuinely match. | Sidebar works in constrained widths; edit/toggle/delete are keyboard accessible; import/export feedback and empty state remain clear. |
| 7. Integration and polish | The popup duplicates some rule UI patterns; CSS is monolithic; panel toast has no live announcement. | Compose the page from section files, group styles with their sections, reuse only stable primitives in popup, and make `Toast` an accessible shared panel component. | English and Spanish, popup, inspected-page notice, tests, build, and manual narrow/wide DevTools review all pass. |

## Component rules

- Extract around a clear responsibility and a small public interface. Avoid wrapping every `div` or moving code solely to reduce file length.
- Keep panel state and Chrome messaging at the container boundary. Pass focused props/callbacks to presentation components; keep pure request/rule formatting in `src/lib`.
- A shared component earns its place when two surfaces use the same behavior and semantics. Similar appearance alone is insufficient, especially for the injected notification, which runs in the inspected page rather than Solid's panel tree.
- Use semantic buttons, labels, tab roles, and status text. Decorative SVGs use `aria-hidden`; meaningful icon-only buttons receive an accessible label.
- Split CSS by section while retaining shared color/type/spacing tokens. Avoid changing the app's established dark DevTools feel unless a section review explicitly approves it.

## Validation at each review stop

Run `npm test` and `npm run build` after each section. Review the affected interactions in a built extension, including an empty list, captured traffic, hidden traffic, matched and unmatched rules, blocked responses, and English/Spanish. Add focused tests for behavior that changes or has a realistic regression risk; do not add tests that merely mirror markup.

## Confirmed scope and remaining decision

- The seven sections and their order are accepted as review stops.
- The popup receives the same visual refresh in section 7.
- Keyboard and accessibility fixes and narrow-width improvements are included in the relevant sections.
- MPL 2.0 is the selected license for the open core. Section 1 added locally bundled Tabler icons, shared UI components, visible focus styles, and accessible disclosure buttons. The production build includes `LICENSE` and `THIRD_PARTY_NOTICES.txt`; the user committed section 1.
- Section 2 extracted `PanelToolbar`, `RecordingControl`, `RequestSearch`, `MethodFilter`, `TrafficFilterMenu`, `RulesToggle`, and `LanguageSelector`. The toolbar uses one row above 720 px, two rows down to 441 px, and three rows at 440 px and below. The traffic menu remains within a 320 px viewport, retains hidden counts and saved visibility choices, and closes with Escape. The user committed section 2.
- Section 3 extracts `RequestList`, `RequestListHeader`, `RequestRow`, `RequestListEmptyState`, and `RequestRuleState`. Rows are keyboard-selectable buttons with visible status and rule labels. The captured upstream status remains in `resStatus`; successful overrides add `appliedStatus`, `networkFailureApplied`, and `appliedBlockRequest` so displayed outcomes stay accurate after rule changes. Empty states distinguish no capture, no filter matches, and hidden matching traffic. The user committed section 3.
- Section 4 extracts `RequestDetail`, `DetailHeader`, `DetailTabs`, `RequestDetails`, `ResponseDetails`, `HeadersTable`, `CodeBlock`, and `GraphQLDetails` with their section CSS. Tabs use arrow, Home, and End keys; the saved-rule detail shows only its applicable Rule tab. Applied and original response statuses are labeled in the header, and the response tab explicitly labels its captured upstream headers and body. The detail panel stacks below the request list at narrow widths. Section 4 changes remain uncommitted for review.
- Shared control follow-up for section 4: `Button`, `Input`, `Select`, `TextArea`, `FieldLabel`, `FormField`, `CheckboxField`, and `ToggleSwitch` now live in `src/ui/controls` and are used across the toolbar, request list, detail tabs, rule editor, sidebar, and popup. The rule editor's labels and hints are associated with their fields, and the panel and popup share button, form, and toggle styles. This follow-up remains uncommitted with section 4.

No commits will be made; the user reviews and commits the changes.
