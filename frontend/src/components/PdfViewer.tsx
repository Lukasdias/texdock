import { useEffect, useRef, useState } from "react";
import * as pdfjsLib from "pdfjs-dist";

pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  "pdfjs-dist/build/pdf.worker.mjs",
  import.meta.url,
).toString();

interface PdfViewerProps {
  pdfUrl: string;
  revision: number;
}

type ViewerState = "loading" | "empty" | "ready" | "error";

export function PdfViewer({ pdfUrl, revision }: PdfViewerProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [state, setState] = useState<ViewerState>("loading");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return undefined;
    let cancelled = false;
    const previousScroll = container.scrollTop;
    const scrollContainer = container;

    async function render() {
      setState("loading");
      setError(null);
      try {
        const separator = pdfUrl.includes("?") ? "&" : "?";
        const response = await fetch(`${pdfUrl}${separator}v=${revision}`, {
          cache: "no-store",
        });
        if (cancelled) return;
        if (response.status === 404) {
          setState("empty");
          return;
        }
        if (!response.ok) {
          throw new Error(`PDF request failed (${response.status})`);
        }

        const data = new Uint8Array(await response.arrayBuffer());
        const loadingTask = pdfjsLib.getDocument({ data });
        const pdfDocument = await loadingTask.promise;
        if (cancelled) {
          void loadingTask.destroy();
          return;
        }

        scrollContainer.replaceChildren();
        const dpr = window.devicePixelRatio || 1;
        const containerWidth = scrollContainer.clientWidth || 800;

        for (
          let pageNumber = 1;
          pageNumber <= pdfDocument.numPages;
          pageNumber += 1
        ) {
          const page = await pdfDocument.getPage(pageNumber);
          if (cancelled) {
            void loadingTask.destroy();
            return;
          }
          const unscaled = page.getViewport({ scale: 1 });
          const cssScale = Math.min(2, containerWidth / unscaled.width);
          const viewport = page.getViewport({ scale: cssScale * dpr });

          const canvas = document.createElement("canvas");
          canvas.width = Math.floor(viewport.width);
          canvas.height = Math.floor(viewport.height);
          canvas.style.width = `${viewport.width / dpr}px`;
          canvas.style.height = `${viewport.height / dpr}px`;
          canvas.className = "block bg-white shadow-sm";

          const context = canvas.getContext("2d");
          if (!context) throw new Error("2D canvas context unavailable");

          const wrapper = document.createElement("div");
          wrapper.dataset.page = String(pageNumber);
          wrapper.className = "relative mx-auto mb-2 w-fit";
          wrapper.appendChild(canvas);
          scrollContainer.appendChild(wrapper);

          await page.render({ canvas, canvasContext: context, viewport })
            .promise;
        }

        scrollContainer.scrollTop = previousScroll;
        setState("ready");
      } catch (loadError) {
        if (!cancelled) {
          setError(
            loadError instanceof Error ? loadError.message : "Failed to load PDF",
          );
          setState("error");
        }
      }
    }

    void render();
    return () => {
      cancelled = true;
    };
  }, [pdfUrl, revision]);

  return (
    <div className="relative h-full min-h-0">
      <div
        ref={containerRef}
        data-pdf-scroll
        className="h-full overflow-auto p-2"
      />
      {state !== "ready" ? (
        <div
          className="pointer-events-none absolute inset-0 flex items-center justify-center p-6 text-center text-sm"
          data-state={state}
        >
          {state === "empty" ? (
            <span className="text-muted-foreground">
              No PDF yet — compile to preview.
            </span>
          ) : state === "error" ? (
            <span className="text-destructive">{error}</span>
          ) : (
            <span className="text-muted-foreground">Loading PDF…</span>
          )}
        </div>
      ) : null}
    </div>
  );
}
