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

  it('does not treat non-file parentheticals as the open file', () => {
    const log =
      "(./main.tex\n" +
      "(/usr/share/texlive/texmf-dist/tex/latex/base/article.cls\n" +
      "File: size10.clo 2024/06/29 (size option)\n" +
      ")\n" +
      "! LaTeX Error: File `cv-common.sty' not found.\n" +
      "or enter new name. (Default extension: sty)\n" +
      "! Emergency stop.\n" +
      "l.3 \\begin{document}\n";
    const files = parseProblems(log).map((p) => p.file);
    expect(files).toEqual(["main.tex", "main.tex"]);
  });
});

describe("synctex coordinate transform", () => {
  it("round-trips a page pixel point", () => {
    const viewport = { width: 612, height: 792, scale: 2 };
    const pdf = pdfPointFromPagePixels(1, 100, 200, viewport);
    expect(pagePixelsFromPdfPoint(1, pdf.x, pdf.y, viewport)).toEqual({ x: 100, y: 200 });
  });
});
