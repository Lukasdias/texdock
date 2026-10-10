import { describe, it, expect } from "vitest";
import {
  composeTransform,
  indexPageText,
  findMatches,
  matchRects,
  type PlacedTextItem,
} from "./pdfSearch";

function item(partial: Partial<PlacedTextItem> & { text: string }): PlacedTextItem {
  return { x: 0, y: 0, width: 0, height: 0, ...partial };
}

describe("composeTransform", () => {
  it("applies the inner transform then the outer one", () => {
    expect(composeTransform([1, 0, 0, 1, 10, 20], [2, 0, 0, 2, 0, 0])).toEqual([
      2, 0, 0, 2, 10, 20,
    ]);
  });

  it("flips the y-axis like a page viewport", () => {
    expect(composeTransform([1, 0, 0, -1, 0, 100], [1, 0, 0, 1, 5, 10])).toEqual([
      1, 0, 0, -1, 5, 90,
    ]);
  });
});

describe("indexPageText", () => {
  it("joins items with a separator and records each character's origin", () => {
    const index = indexPageText([item({ text: "Hello" }), item({ text: "world" })]);
    expect(index.text).toBe("Hello world");
    expect(index.origin).toHaveLength(11);
    expect(index.origin[5]).toBeNull();
    expect(index.origin[6]).toEqual({ item: 1, offset: 0 });
  });

  it("skips empty items", () => {
    const index = indexPageText([item({ text: "" }), item({ text: "x" })]);
    expect(index.text).toBe("x");
    expect(index.origin).toEqual([{ item: 1, offset: 0 }]);
  });
});

describe("findMatches", () => {
  const index = indexPageText([item({ text: "Vis-viva equation" })]);

  it("matches case-insensitively", () => {
    const matches = findMatches(index, "VIS");
    expect(matches).toHaveLength(1);
    expect(index.text.slice(matches[0].start, matches[0].end)).toBe("Vis");
  });

  it("returns non-overlapping matches in order", () => {
    const aa = indexPageText([item({ text: "aaaa" })]);
    expect(findMatches(aa, "aa")).toHaveLength(2);
  });

  it("returns nothing for an empty query", () => {
    expect(findMatches(index, "")).toEqual([]);
  });

  it("spans multiple items, skipping the separator", () => {
    const split = indexPageText([item({ text: "vis" }), item({ text: "viva" })]);
    const [match] = findMatches(split, "s v");
    expect(match.spans).toEqual([
      { item: 0, start: 2, end: 3 },
      { item: 1, start: 0, end: 1 },
    ]);
  });
});

describe("matchRects", () => {
  it("maps a partial span to a proportional rectangle", () => {
    const items = [item({ text: "abcd", x: 10, y: 20, width: 40, height: 10 })];
    const index = indexPageText(items);
    const [match] = findMatches(index, "bc");
    expect(matchRects(match, items)).toEqual([[20, 10, 40, 20]]);
  });
});
