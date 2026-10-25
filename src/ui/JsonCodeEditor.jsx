import { createEffect, onCleanup, onMount } from "solid-js";
import { EditorView, basicSetup } from "codemirror";
import { indentUnit, HighlightStyle, syntaxHighlighting } from "@codemirror/language";
import { json, jsonParseLinter } from "@codemirror/lang-json";
import { linter, lintGutter } from "@codemirror/lint";
import { tags } from "@lezer/highlight";

const jsonHighlightStyle = HighlightStyle.define([
  { tag: tags.propertyName, color: "#9cdcfe" },
  { tag: tags.string, color: "#ce9178" },
  { tag: tags.number, color: "#b5cea8" },
  { tag: [tags.bool, tags.null], color: "#569cd6" },
  { tag: tags.invalid, color: "#f44747" },
]);

const editorTheme = EditorView.theme({
  "&": { height: "100%", backgroundColor: "transparent", color: "#cccccc" },
  ".cm-scroller": { fontFamily: "var(--font-mono)", fontSize: "11px", lineHeight: "1.5", overflow: "auto" },
  ".cm-content": { padding: "5px 0", caretColor: "#ffffff" },
  ".cm-line": { padding: "0 8px" },
  ".cm-gutters": { backgroundColor: "#303030", color: "#858585", borderRight: "1px solid #4a4a4a" },
  ".cm-activeLine, .cm-activeLineGutter": { backgroundColor: "#ffffff0d" },
  ".cm-selectionBackground, &.cm-focused .cm-selectionBackground": { backgroundColor: "#094771" },
  ".cm-cursor, .cm-dropCursor": { borderLeftColor: "#ffffff" },
  ".cm-lintRange-error": { backgroundImage: "none", textDecoration: "underline wavy #f44747", textUnderlineOffset: "3px" },
}, { dark: true });

const parseJSON = jsonParseLinter();

function lintJSONBody(view) {
  // A response body may be plain text. Only report JSON errors for object/array drafts.
  if (!/^\s*[\[{]/.test(view.state.doc.toString())) return [];
  return parseJSON(view);
}

export function JsonCodeEditor(props) {
  let container;
  let view;
  let syncingFromProps = false;

  onMount(() => {
    view = new EditorView({
      parent: container,
      doc: props.value ?? "",
      extensions: [
        basicSetup,
        json(),
        indentUnit.of("  "),
        EditorView.lineWrapping,
        syntaxHighlighting(jsonHighlightStyle),
        linter(lintJSONBody),
        lintGutter(),
        editorTheme,
        EditorView.contentAttributes.of({
          id: props.id,
          "aria-labelledby": props.labelId,
          "aria-describedby": props.describedBy,
          spellcheck: "false",
        }),
        EditorView.updateListener.of((update) => {
          if (update.docChanged && !syncingFromProps) props.onChange(update.state.doc.toString());
        }),
      ],
    });
  });

  createEffect(() => {
    const value = props.value ?? "";
    if (view && value !== view.state.doc.toString()) {
      syncingFromProps = true;
      try {
        view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: value } });
      } finally {
        syncingFromProps = false;
      }
    }
  });

  onCleanup(() => view?.destroy());

  return <div class="json-code-editor" ref={container} />;
}
