import { useEffect, useRef } from "react";
import { ChevronDown, ChevronUp, Search, X } from "lucide-react";
import { cn } from "@/lib/utils";

interface PdfSearchBarProps {
  query: string;
  onQueryChange: (value: string) => void;
  matchCount: number;
  /** Zero-based index of the active match, or -1 when there are none. */
  activeIndex: number;
  onNext: () => void;
  onPrev: () => void;
  onClose: () => void;
}

export function PdfSearchBar({
  query,
  onQueryChange,
  matchCount,
  activeIndex,
  onNext,
  onPrev,
  onClose,
}: PdfSearchBarProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    inputRef.current?.focus();
    inputRef.current?.select();
  }, []);

  const noResults = query.trim().length > 0 && matchCount === 0;

  return (
    <div className="panel-sheen absolute top-3 right-3 z-20 flex items-center gap-1 rounded-sm border border-border py-1 pr-1 pl-2 shadow-md">
      <Search className="size-3.5 shrink-0 text-muted-foreground" />
      <input
        ref={inputRef}
        value={query}
        onChange={(event) => onQueryChange(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Escape") {
            event.preventDefault();
            onClose();
          } else if (event.key === "Enter") {
            event.preventDefault();
            if (event.shiftKey) onPrev();
            else onNext();
          }
        }}
        placeholder="Find in PDF"
        aria-label="Find in PDF"
        className="h-6 w-40 bg-transparent font-mono text-xs text-foreground outline-none placeholder:text-muted-foreground"
      />
      <span
        className={cn(
          "min-w-[3.25rem] text-center font-mono text-[10px] tabular-nums",
          noResults ? "text-destructive" : "text-muted-foreground",
        )}
      >
        {matchCount === 0 ? "0 / 0" : `${activeIndex + 1} / ${matchCount}`}
      </span>
      <button
        type="button"
        onClick={onPrev}
        disabled={matchCount === 0}
        aria-label="Previous match"
        className="inline-flex size-6 items-center justify-center rounded-[1px] text-muted-foreground hover:bg-accent hover:text-primary disabled:opacity-40"
      >
        <ChevronUp className="size-3.5" />
      </button>
      <button
        type="button"
        onClick={onNext}
        disabled={matchCount === 0}
        aria-label="Next match"
        className="inline-flex size-6 items-center justify-center rounded-[1px] text-muted-foreground hover:bg-accent hover:text-primary disabled:opacity-40"
      >
        <ChevronDown className="size-3.5" />
      </button>
      <button
        type="button"
        onClick={onClose}
        aria-label="Close find"
        className="inline-flex size-6 items-center justify-center rounded-[1px] text-muted-foreground hover:bg-accent hover:text-primary"
      >
        <X className="size-3.5" />
      </button>
    </div>
  );
}
