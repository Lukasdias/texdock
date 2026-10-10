export interface PdfViewport {
  width: number;
  height: number;
  scale: number;
}

export interface PagePoint {
  x: number;
  y: number;
}

/**
 * Convert a point measured in rendered page pixels into SyncTeX PDF points.
 * A page is uniformly scaled by `viewport.scale`, so this is a pure division.
 */
export function pdfPointFromPagePixels(
  _page: number,
  x: number,
  y: number,
  viewport: PdfViewport,
): PagePoint {
  return { x: x / viewport.scale, y: y / viewport.scale };
}

/**
 * Inverse of {@link pdfPointFromPagePixels}: PDF points back to page pixels.
 */
export function pagePixelsFromPdfPoint(
  _page: number,
  x: number,
  y: number,
  viewport: PdfViewport,
): PagePoint {
  return { x: x * viewport.scale, y: y * viewport.scale };
}
