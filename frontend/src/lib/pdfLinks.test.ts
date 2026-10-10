import { describe, it, expect } from "vitest";
import { extractLinkOverlays } from "./pdfLinks";

const identity = (rect: number[]) => rect;

describe("extractLinkOverlays", () => {
  it("keeps only Link annotations that have a non-empty rect", () => {
    const overlays = extractLinkOverlays(
      [
        { subtype: "Link", rect: [10, 20, 110, 40], url: "https://example.com" },
        { subtype: "Text", rect: [0, 0, 10, 10] },
        { subtype: "Link", rect: [5, 5, 5, 9], url: "https://zero.example" },
        { subtype: "Link", url: "https://no-rect.example" },
      ],
      identity,
    );
    expect(overlays).toHaveLength(1);
    expect(overlays[0].url).toBe("https://example.com");
    expect(overlays[0].rect).toEqual([10, 20, 110, 40]);
  });

  it("normalizes an inverted rect into top-left / bottom-right order", () => {
    const overlays = extractLinkOverlays(
      [{ subtype: "Link", rect: [100, 40, 10, 20], url: "u" }],
      identity,
    );
    expect(overlays[0].rect).toEqual([10, 20, 100, 40]);
  });

  it("carries internal destinations when there is no url", () => {
    const dest = [{ num: 5, gen: 0 }, { name: "XYZ" }];
    const overlays = extractLinkOverlays(
      [{ subtype: "Link", rect: [0, 0, 10, 10], dest }],
      identity,
    );
    expect(overlays[0].url).toBeNull();
    expect(overlays[0].dest).toBe(dest);
  });
});
