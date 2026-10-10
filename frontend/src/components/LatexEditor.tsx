import { useEffect, useRef, useState, type RefObject } from "react";
import { EditorState } from "@codemirror/state";
import {
  EditorView,
  drawSelection,
  dropCursor,
  highlightActiveLine,
  highlightActiveLineGutter,
  keymap,
  lineNumbers,
  rectangularSelection,
} from "@codemirror/view";
import {
  bracketMatching,
  defaultHighlightStyle,
  indentOnInput,
  syntaxHighlighting,
} from "@codemirror/language";
import {
  autocompletion,
  closeBrackets,
  completionKeymap,
  type Completion,
  type CompletionContext,
  type CompletionResult,
} from "@codemirror/autocomplete";
import { defaultKeymap, history, historyKeymap } from "@codemirror/commands";
import { searchKeymap } from "@codemirror/search";
import { latex, latexCompletionSource } from "codemirror-lang-latex";
import { Crosshair } from "lucide-react";
import { toast } from "sonner";
import { useCompile, useFile, useSaveFile } from "@/lib/queries";
import { useAutosave } from "@/hooks/useAutosave";

interface LatexEditorProps {
  projectId: string;
  path: string;
  projectFiles: string[];
  revealLine?: { line: number; nonce: number };
  onForwardSearch?: (file: string, line: number) => void;
}

const editorTheme = EditorView.theme(
  {
    "&": {
      height: "100%",
      fontSize: "13px",
      backgroundColor: "var(--background)",
      color: "var(--foreground)",
    },
    ".cm-content": {
      fontFamily:
        "ui-monospace, SFMono-Regular, Menlo, Consolas, 'Liberation Mono', monospace",
    },
    ".cm-gutters": {
      backgroundColor: "var(--background)",
      color: "var(--muted-foreground)",
      border: "none",
    },
    ".cm-activeLine": {
      backgroundColor: "color-mix(in srgb, var(--accent) 45%, transparent)",
    },
    ".cm-activeLineGutter": {
      backgroundColor: "color-mix(in srgb, var(--accent) 45%, transparent)",
    },
    "&.cm-focused .cm-selectionBackground, .cm-selectionBackground, ::selection":
      {
        backgroundColor: "color-mix(in srgb, var(--primary) 35%, transparent)",
      },
    ".cm-cursor, .cm-dropCursor": { borderLeftColor: "var(--foreground)" },
  },
  { dark: true },
);

const COMMAND_BEFORE =
  /\\(?:ref|eqref|cite|input|include|usepackage)\{[^}]*$/;

function extractMatches(doc: string, pattern: RegExp): string[] {
  const found: string[] = [];
  for (const match of doc.matchAll(pattern)) {
    if (match[1]) found.push(match[1]);
  }
  return found;
}

function projectCompletionSource(
  projectFilesRef: RefObject<string[]>,
): (context: CompletionContext) => CompletionResult | null {
  return (context) => {
    const before = context.matchBefore(COMMAND_BEFORE);
    if (!before) return null;

    const text = before.text;
    const braceIndex = text.indexOf("{");
    const command = text.slice(1, braceIndex);
    const doc = context.state.doc.toString();

    let options: Completion[] = [];
    if (
      command === "input" ||
      command === "include" ||
      command === "usepackage"
    ) {
      options = projectFilesRef.current.map((file) => ({
        label: file,
        type: "text",
      }));
    } else if (command === "cite") {
      options = extractMatches(
        doc,
        /\\bibitem(?:\[[^\]]*\])?\{([^}]+)\}/g,
      ).map((key) => ({ label: key, type: "property" }));
    } else {
      options = extractMatches(doc, /\\label\{([^}]+)\}/g).map((key) => ({
        label: key,
        type: "property",
      }));
    }

    return {
      from: before.from + braceIndex + 1,
      options,
      validFor: /^[^{}]*$/,
    };
  };
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Something went wrong";
}

export function LatexEditor({
  projectId,
  path,
  projectFiles,
  revealLine,
  onForwardSearch,
}: LatexEditorProps) {
  const fileQuery = useFile(projectId, path);
  const saveFile = useSaveFile(projectId);
  const compile = useCompile(projectId);

  const containerRef = useRef<HTMLDivElement | null>(null);
  const viewRef = useRef<EditorView | null>(null);
  const projectFilesRef = useRef(projectFiles);
  useEffect(() => {
    projectFilesRef.current = projectFiles;
  }, [projectFiles]);

  const onForwardSearchRef = useRef(onForwardSearch);
  useEffect(() => {
    onForwardSearchRef.current = onForwardSearch;
  }, [onForwardSearch]);

  const [initialContent, setInitialContent] = useState<string | null>(null);
  const [doc, setDoc] = useState("");

  function triggerForwardSearch() {
    const view = viewRef.current;
    if (!view || !onForwardSearchRef.current) return;
    const line = view.state.doc.lineAt(view.state.selection.main.head).number;
    onForwardSearchRef.current(path, line);
  }

  useEffect(() => {
    if (initialContent === null && fileQuery.data) {
      setInitialContent(fileQuery.data.content);
      setDoc(fileQuery.data.content);
    }
  }, [fileQuery.data, initialContent]);

  async function saveNow(text: string) {
    await saveFile.mutateAsync({ path, content: text });
    await compile.mutateAsync();
  }

  const saveNowRef = useRef(saveNow);
  useEffect(() => {
    saveNowRef.current = saveNow;
  });

  const { status } = useAutosave(doc, {
    delayMs: 2000,
    enabled: initialContent !== null,
    baseline: initialContent ?? undefined,
    onSave: (value) =>
      saveNowRef.current(value).catch((error: unknown) => {
        toast.error(`Save failed: ${errorMessage(error)}`);
        throw error;
      }),
  });

  useEffect(() => {
    if (initialContent === null || !containerRef.current) return undefined;

    const view = new EditorView({
      state: EditorState.create({
        doc: initialContent,
        extensions: [
          lineNumbers(),
          highlightActiveLineGutter(),
          highlightActiveLine(),
          history(),
          drawSelection(),
          dropCursor(),
          EditorState.allowMultipleSelections.of(true),
          indentOnInput(),
          bracketMatching(),
          closeBrackets(),
          rectangularSelection(),
          EditorView.lineWrapping,
          syntaxHighlighting(defaultHighlightStyle, { fallback: true }),
          autocompletion({
            override: [
              latexCompletionSource(false),
              projectCompletionSource(projectFilesRef),
            ],
            defaultKeymap: true,
            activateOnTyping: true,
            icons: true,
          }),
          keymap.of([
            {
              key: "Mod-s",
              preventDefault: true,
              run: () => {
                void saveNowRef.current(view.state.doc.toString());
                return true;
              },
            },
            {
              key: "Mod-Alt-j",
              preventDefault: true,
              run: () => {
                triggerForwardSearch();
                return true;
              },
            },
            ...defaultKeymap,
            ...historyKeymap,
            ...searchKeymap,
            ...completionKeymap,
          ]),
          latex({ enableAutocomplete: false, autoCloseBrackets: false }),
          editorTheme,
          EditorView.updateListener.of((update) => {
            if (update.docChanged) {
              setDoc(update.state.doc.toString());
            }
          }),
        ],
      }),
      parent: containerRef.current,
    });

    viewRef.current = view;
    return () => {
      view.destroy();
      viewRef.current = null;
    };
  }, [initialContent]);

  useEffect(() => {
    const view = viewRef.current;
    if (!view || !revealLine) return;
    const lineNumber = Math.min(
      Math.max(revealLine.line, 1),
      view.state.doc.lines,
    );
    const line = view.state.doc.line(lineNumber);
    view.dispatch({
      selection: { anchor: line.from },
      effects: EditorView.scrollIntoView(line.from, { y: "center" }),
    });
    view.focus();
  }, [revealLine, initialContent]);

  if (fileQuery.isLoading) {
    return (
      <p className="p-4 text-sm text-muted-foreground">Loading file…</p>
    );
  }

  if (fileQuery.isError || !fileQuery.data) {
    return (
      <p className="p-4 text-sm text-destructive">Could not load {path}.</p>
    );
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex h-7 shrink-0 items-center justify-between border-b px-2 text-xs text-muted-foreground">
        <span className="truncate font-mono">{path}</span>
        <span className="flex items-center gap-2">
          <span>
            {status === "saving"
              ? "Saving…"
              : status === "saved"
                ? "Saved"
                : ""}
          </span>
          <button
            type="button"
            onClick={triggerForwardSearch}
            title="Sync to PDF (Ctrl+Alt+J)"
            aria-label="Sync to PDF"
            className="inline-flex size-5 items-center justify-center rounded-sm hover:bg-accent hover:text-accent-foreground"
          >
            <Crosshair className="size-3.5" />
          </button>
        </span>
      </div>
      <div ref={containerRef} className="min-h-0 flex-1 overflow-hidden" />
    </div>
  );
}
