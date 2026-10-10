import { describe, it, expect } from "vitest";
import { pdfPointFromPagePixels, pagePixelsFromPdfPoint } from "./synctex";

describe("synctex coordinate transform", () => {
  it("round-trips a page pixel point", () => {
    const viewport = { width: 612, height: 792, scale: 2 };
    const pdf = pdfPointFromPagePixels(1, 100, 200, viewport);
    expect(pagePixelsFromPdfPoint(1, pdf.x, pdf.y, viewport)).toEqual({ x: 100, y: 200 });
  });
});
