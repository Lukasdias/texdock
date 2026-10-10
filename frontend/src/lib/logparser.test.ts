import { describe, it, expect } from "vitest";
import { parseProblems } from "./logparser";
import { pdfPointFromPagePixels, pagePixelsFromPdfPoint } from "./synctex";

describe("parseProblems", () => {
  it("extracts an error with file and line", () => {
    const log = "(./main.tex\n! Undefined control sequence.\nl.12 \\badcommand\n";
    expect(parseProblems(log)).toEqual([
      { kind: "error", file: "main.tex", line: 12, message: "Undefined control sequence." },
    ]);
  });
});

describe("synctex coordinate transform", () => {
  it("round-trips a page pixel point", () => {
    const viewport = { width: 612, height: 792, scale: 2 };
    const pdf = pdfPointFromPagePixels(1, 100, 200, viewport);
    expect(pagePixelsFromPdfPoint(1, pdf.x, pdf.y, viewport)).toEqual({ x: 100, y: 200 });
  });
});
