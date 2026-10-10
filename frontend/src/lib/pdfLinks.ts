/**
 * Turn pdf.js link annotations into positioned overlays.
 *
 * pdf.js paints page content to a canvas and keeps link annotations separate
 * (they are not part of the content stream), so they must be rendered as DOM
 * elements on top of the canvas to be clickable.
 */

export interface PdfAnnotation {
  subtype?: string;
  rect?: number[];
  url?: string | null;
  dest?: unknown;
}

export interface LinkOverlay {
  url: string | null;
  dest: unknown;
  /** Top-left origin, in CSS pixels: [left, top, right, bottom]. */
  rect: [number, number, number, number];
}

export function extractLinkOverlays(
  annotations: readonly PdfAnnotation[],
  convertRect: (rect: number[]) => number[],
): LinkOverlay[] {
  const overlays: LinkOverlay[] = [];
  for (const annotation of annotations) {
    if (annotation.subtype !== "Link") continue;
    if (!annotation.rect || annotation.rect.length < 4) continue;

    const [x1, y1, x2, y2] = convertRect(annotation.rect);
    const rect: [number, number, number, number] = [
      Math.min(x1, x2),
      Math.min(y1, y2),
      Math.max(x1, x2),
      Math.max(y1, y2),
    ];
    if (rect[2] - rect[0] <= 0 || rect[3] - rect[1] <= 0) continue;

    overlays.push({ url: annotation.url ?? null, dest: annotation.dest ?? null, rect });
  }
  return overlays;
}
