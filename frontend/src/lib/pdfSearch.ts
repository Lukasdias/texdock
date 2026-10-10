/**
 * Case-insensitive substring search over the text of a rendered PDF page.
 *
 * pdf.js returns text as positioned fragments ("items"), not lines. We join a
 * page's items into one string (recording where every character came from) so
 * a query can span fragments, then map a match back to highlight rectangles.
 */

export interface PlacedTextItem {
  text: string;
  /** Baseline start, in viewport (CSS) pixels. */
  x: number;
  y: number;
  /** Advance width, in viewport pixels. */
  width: number;
  /** Font height, in viewport pixels. */
  height: number;
}

export type Rect = [number, number, number, number];

export interface CharOrigin {
  item: number;
  offset: number;
}

export interface PageTextIndex {
  text: string;
  /** Per-character source, or null for the separator inserted between items. */
  origin: (CharOrigin | null)[];
}

export interface CharSpan {
  item: number;
  start: number;
  end: number;
}

export interface TextMatch {
  start: number;
  end: number;
  spans: CharSpan[];
}

/** Affine matrix composition, equivalent to pdf.js `Util.transform(m1, m2)`. */
export function composeTransform(m1: number[], m2: number[]): number[] {
  return [
    m1[0] * m2[0] + m1[2] * m2[1],
    m1[1] * m2[0] + m1[3] * m2[1],
    m1[0] * m2[2] + m1[2] * m2[3],
    m1[1] * m2[2] + m1[3] * m2[3],
    m1[0] * m2[4] + m1[2] * m2[5] + m1[4],
    m1[1] * m2[4] + m1[3] * m2[5] + m1[5],
  ];
}

export function indexPageText(items: readonly PlacedTextItem[]): PageTextIndex {
  let text = "";
  const origin: (CharOrigin | null)[] = [];
  items.forEach((item, itemIndex) => {
    if (item.text.length === 0) return;
    if (text.length > 0) {
      text += " ";
      origin.push(null);
    }
    for (let offset = 0; offset < item.text.length; offset += 1) {
      text += item.text[offset];
      origin.push({ item: itemIndex, offset });
    }
  });
  return { text, origin };
}

function spansForRange(
  index: PageTextIndex,
  start: number,
  end: number,
): CharSpan[] {
  const spans: CharSpan[] = [];
  for (let i = start; i < end; i += 1) {
    const source = index.origin[i];
    if (!source) continue;
    const last = spans[spans.length - 1];
    if (last && last.item === source.item && last.end === source.offset) {
      last.end = source.offset + 1;
    } else {
      spans.push({
        item: source.item,
        start: source.offset,
        end: source.offset + 1,
      });
    }
  }
  return spans;
}

export function findMatches(index: PageTextIndex, query: string): TextMatch[] {
  const needle = query.toLowerCase();
  if (!needle) return [];
  const haystack = index.text.toLowerCase();
  const matches: TextMatch[] = [];
  let from = 0;
  while (from <= haystack.length - needle.length) {
    const at = haystack.indexOf(needle, from);
    if (at === -1) break;
    const end = at + needle.length;
    matches.push({ start: at, end, spans: spansForRange(index, at, end) });
    from = end;
  }
  return matches;
}

export function matchRects(
  match: TextMatch,
  items: readonly PlacedTextItem[],
): Rect[] {
  const rects: Rect[] = [];
  for (const span of match.spans) {
    const item = items[span.item];
    if (!item || item.text.length === 0) continue;
    const at = (offset: number) => item.x + (item.width * offset) / item.text.length;
    const left = at(span.start);
    const right = at(span.end);
    rects.push([
      Math.min(left, right),
      item.y - item.height,
      Math.max(left, right),
      item.y,
    ]);
  }
  return rects;
}
