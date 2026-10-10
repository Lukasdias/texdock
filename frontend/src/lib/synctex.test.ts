import { describe, it, expect } from "vitest";
import { pdfPointFromPagePixels, pagePixelsFromPdfPoint } from "./synctex";

describe("synctex coordinate transform", () => {
  it("round-trips a page pixel point", () => {
    const viewport = { width: 612, height: 792, scale: 2 };
    const pdf = pdfPointFromPagePixels(1, 100, 200, viewport);
    expect(pagePixelsFromPdfPoint(1, pdf.x, pdf.y, viewport)).toEqual({ x: 100, y: 200 });
  });

  it("accounts for scale when converting pixels to pdf points", () => {
    const viewport = { width: 612, height: 792, scale: 3 };
    expect(pdfPointFromPagePixels(1, 306, 396, viewport)).toEqual({ x: 102, y: 132 });
  });

  it("returns an identity pair when scale is 1", () => {
    const sv = { width: 612, height: 792, scale: 1 };
    const p = pagePixelsFromPdfPoint(1, 50, 60, sv);
    expect(p).toEqual({ x: 50, y: 60 });
  });
});
