import { useEffect, useMemo, useRef, useState, type MouseEvent } from "react";
import * as pdfjsLib from "pdfjs-dist";
import type { PDFDocumentProxy } from "pdfjs-dist";
import { PdfSearchBar } from "@/components/PdfSearchBar";
import { extractLinkOverlays, type LinkOverlay } from "@/lib/pdfLinks";
import {
  composeTransform,
  findMatches,
  indexPageText,
  matchRects,
  type PlacedTextItem,
  type TextMatch,
} from "@/lib/pdfSearch";
import {
  pagePixelsFromPdfPoint,
  pdfPointFromPagePixels,
} from "@/lib/synctex";

pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  "pdfjs-dist/build/pdf.worker.mjs",
  import.meta.url,
).toString();

/**
 * A transparent, positioned anchor over a PDF link annotation. External links
 * open in a new tab; internal destinations scroll the viewer. Ctrl/⌘-click is
 * left to bubble so the viewer's inverse SyncTeX search still works.
 */
function createLinkOverlay(
  link: LinkOverlay,
  onFollowInternal: (dest: unknown) => void,
): HTMLAnchorElement {
  const anchor = document.createElement("a");
  anchor.className = "pdf-link";
  anchor.style.left = `${link.rect[0]}px`;
  anchor.style.top = `${link.rect[1]}px`;
  anchor.style.width = `${link.rect[2] - link.rect[0]}px`;
  anchor.style.height = `${link.rect[3] - link.rect[1]}px`;

  if (link.url) {
    anchor.href = link.url;
    anchor.target = "_blank";
    anchor.rel = "noopener noreferrer";
    anchor.title = link.url;
  } else {
    anchor.href = "#";
    anchor.setAttribute("role", "link");
  }

  anchor.addEventListener("click", (event) => {
    if (event.ctrlKey || event.metaKey) {
      event.preventDefault();
      return;
    }
    if (!link.url) {
      event.preventDefault();
      onFollowInternal(link.dest);
    }
  });

  return anchor;
}

interface PdfViewerProps {
  pdfUrl: string;
  revision: number;
  revealTarget?: { page: number; x: number; y: number; nonce: number };
  onInverseSearch?: (page: number, x: number, y: number) => void;
}

type ViewerState = "loading" | "empty" | "ready" | "error";

export function PdfViewer({
  pdfUrl,
  revision,
  revealTarget,
  onInverseSearch,
}: PdfViewerProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [state, setState] = useState<ViewerState>("loading");
  const [error, setError] = useState<string | null>(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [pageText, setPageText] = useState<Map<number, PlacedTextItem[]>>(
    () => new Map(),
  );
  const [selection, setSelection] = useState<{ query: string; index: number }>({
    query: "",
    index: 0,
  });

  // Derived during render from the extracted page text, so changing the query
  // never cascades a re-render.
  const matches = useMemo(() => {
    const needle = query.trim();
    if (!needle) return [] as { page: number; match: TextMatch }[];
    const found: { page: number; match: TextMatch }[] = [];
    for (const [page, items] of pageText) {
      const index = indexPageText(items);
      for (const match of findMatches(index, needle)) {
        found.push({ page, match });
      }
    }
    found.sort((a, b) => a.page - b.page || a.match.start - b.match.start);
    return found;
  }, [query, pageText]);

  const activeMatch = matches.length
    ? selection.query === query
      ? selection.index % matches.length
      : 0
    : 0;

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
        const textByPage = new Map<number, PlacedTextItem[]>();

        async function followDestination(dest: unknown) {
          try {
            const resolved =
              typeof dest === "string"
                ? await pdfDocument.getDestination(dest)
                : dest;
            if (!Array.isArray(resolved) || resolved.length === 0) return;
            const pageIndex = await pdfDocument.getPageIndex(
              resolved[0] as Parameters<PDFDocumentProxy["getPageIndex"]>[0],
            );
            scrollContainer
              .querySelector<HTMLElement>(`[data-page="${pageIndex + 1}"]`)
              ?.scrollIntoView({ behavior: "smooth", block: "start" });
          } catch {
            // unresolvable internal destination — ignore
          }
        }

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
          canvas.className = "block bg-white";

          const context = canvas.getContext("2d");
          if (!context) throw new Error("2D canvas context unavailable");

          const wrapper = document.createElement("div");
          wrapper.dataset.page = String(pageNumber);
          wrapper.dataset.scale = String(cssScale);
          wrapper.className = "relative mx-auto mb-2 w-fit border border-border shadow-md";
          wrapper.appendChild(canvas);
          scrollContainer.appendChild(wrapper);

          const cssViewport = page.getViewport({ scale: cssScale });

          try {
            const annotations = await page.getAnnotations();
            for (const link of extractLinkOverlays(annotations, (rect) => {
              const topLeft = cssViewport.convertToViewportPoint(
                rect[0],
                rect[1],
              );
              const bottomRight = cssViewport.convertToViewportPoint(
                rect[2],
                rect[3],
              );
              return [topLeft[0], topLeft[1], bottomRight[0], bottomRight[1]];
            })) {
              wrapper.appendChild(
                createLinkOverlay(link, (dest) => void followDestination(dest)),
              );
            }
          } catch {
            // Annotations are best-effort; keep the page visible without them.
          }

          try {
            const textContent = await page.getTextContent();
            const placed: PlacedTextItem[] = [];
            for (const raw of textContent.items) {
              if (!("str" in raw) || raw.str.length === 0) continue;
              const matrix = composeTransform(
                cssViewport.transform,
                raw.transform,
              );
              placed.push({
                text: raw.str,
                x: matrix[4],
                y: matrix[5],
                width: raw.width * cssScale,
                height: Math.hypot(matrix[2], matrix[3]) || raw.height * cssScale,
              });
            }
            textByPage.set(pageNumber, placed);
          } catch {
            // Text extraction is best-effort; search just finds nothing there.
          }

          await page.render({ canvas, canvasContext: context, viewport })
            .promise;
        }

        scrollContainer.scrollTop = previousScroll;
        setPageText(textByPage);
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

  useEffect(() => {
    const container = containerRef.current;
    if (!container || !revealTarget) return undefined;
    const wrapper = container.querySelector<HTMLElement>(
      `[data-page="${revealTarget.page}"]`,
    );
    if (!wrapper) return undefined;

    const scale = Number(wrapper.dataset.scale ?? "1");
    const point = pagePixelsFromPdfPoint(
      revealTarget.page,
      revealTarget.x,
      revealTarget.y,
      { width: 0, height: 0, scale },
    );

    const targetTop = wrapper.offsetTop + point.y - container.clientHeight / 2;
    container.scrollTo({ top: Math.max(0, targetTop), behavior: "smooth" });

    const marker = document.createElement("div");
    marker.className =
      "pointer-events-none absolute z-10 size-5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary/40 ring-2 ring-primary";
    marker.style.left = `${point.x}px`;
    marker.style.top = `${point.y}px`;
    wrapper.appendChild(marker);

    const timeout = window.setTimeout(() => marker.remove(), 1600);
    return () => {
      window.clearTimeout(timeout);
      marker.remove();
    };
  }, [revealTarget, revision, state]);

  // Ctrl/⌘+F opens the find bar only when focus is inside the PDF panel, so
  // the editor keeps its own search shortcut.
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (!(event.ctrlKey || event.metaKey)) return;
      if (event.key.toLowerCase() !== "f") return;
      const container = containerRef.current;
      const active = document.activeElement;
      if (!container || !active || !container.contains(active)) return;
      event.preventDefault();
      setSearchOpen(true);
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  // Draw highlight boxes and scroll the active match into view.
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    container
      .querySelectorAll<HTMLElement>(".pdf-search-layer")
      .forEach((layer) => layer.remove());

    const layers = new Map<number, HTMLElement>();
    const layerFor = (page: number): HTMLElement | null => {
      const existing = layers.get(page);
      if (existing) return existing;
      const wrapper = container.querySelector<HTMLElement>(
        `[data-page="${page}"]`,
      );
      if (!wrapper) return null;
      const layer = document.createElement("div");
      layer.className = "pdf-search-layer";
      wrapper.appendChild(layer);
      layers.set(page, layer);
      return layer;
    };

    matches.forEach((entry, index) => {
      const items = pageText.get(entry.page) ?? [];
      const layer = layerFor(entry.page);
      if (!layer) return;
      for (const [left, top, right, bottom] of matchRects(entry.match, items)) {
        const box = document.createElement("div");
        box.className =
          index === activeMatch
            ? "pdf-search-hit pdf-search-hit-active"
            : "pdf-search-hit";
        box.style.left = `${left}px`;
        box.style.top = `${top}px`;
        box.style.width = `${right - left}px`;
        box.style.height = `${bottom - top}px`;
        layer.appendChild(box);
      }
    });

    const current = matches[activeMatch];
    if (!current) return;
    const items = pageText.get(current.page) ?? [];
    const rect = matchRects(current.match, items)[0];
    const wrapper = container.querySelector<HTMLElement>(
      `[data-page="${current.page}"]`,
    );
    if (rect && wrapper) {
      const top = wrapper.offsetTop + rect[1] - container.clientHeight / 2;
      container.scrollTo({ top: Math.max(0, top), behavior: "smooth" });
    }
  }, [matches, activeMatch, pageText]);

  function nextMatch() {
    if (!matches.length) return;
    setSelection({ query, index: (activeMatch + 1) % matches.length });
  }

  function prevMatch() {
    if (!matches.length) return;
    setSelection({
      query,
      index: (activeMatch - 1 + matches.length) % matches.length,
    });
  }

  function closeSearch() {
    setSearchOpen(false);
    setQuery("");
  }

  function handleViewerClick(event: MouseEvent<HTMLDivElement>) {
    if (!onInverseSearch) return;
    if (!(event.ctrlKey || event.metaKey)) return;
    const target = event.target as HTMLElement | null;
    const wrapper = target?.closest<HTMLElement>("[data-page]");
    const container = containerRef.current;
    if (!wrapper || !container) return;

    const rect = wrapper.getBoundingClientRect();
    const scale = Number(wrapper.dataset.scale ?? "1");
    const page = Number(wrapper.dataset.page ?? "1");
    const point = pdfPointFromPagePixels(
      page,
      event.clientX - rect.left,
      event.clientY - rect.top,
      { width: 0, height: 0, scale },
    );
    onInverseSearch(page, point.x, point.y);
  }

  return (
    <div className="relative h-full min-h-0">
      <div
        ref={containerRef}
        data-pdf-scroll
        tabIndex={-1}
        onMouseDown={() => containerRef.current?.focus({ preventScroll: true })}
        onClick={handleViewerClick}
        className="panel-inset h-full overflow-auto p-3 outline-none"
      />
      {searchOpen ? (
        <PdfSearchBar
          query={query}
          onQueryChange={setQuery}
          matchCount={matches.length}
          activeIndex={matches.length ? activeMatch : -1}
          onNext={nextMatch}
          onPrev={prevMatch}
          onClose={closeSearch}
        />
      ) : null}
      {state !== "ready" ? (
        <div
          className="pointer-events-none absolute inset-0 flex items-center justify-center p-6 text-center font-mono text-xs tracking-widest uppercase"
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
