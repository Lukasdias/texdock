import { AlertTriangle, CircleAlert } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import type { Problem } from "@/lib/api";

interface ProblemsPanelProps {
  problems: Problem[];
  onOpenProblem: (file: string, line: number | null) => void;
}

export function ProblemsPanel({ problems, onOpenProblem }: ProblemsPanelProps) {
  if (problems.length === 0) {
    return null;
  }

  return (
    <div className="flex max-h-48 shrink-0 flex-col border-t border-border">
      <div className="panel-inset flex h-7 shrink-0 items-center gap-2 border-b border-border px-2 font-condensed text-[11px] font-semibold tracking-[0.14em] text-muted-foreground uppercase">
        <span aria-hidden className="size-1.5 rounded-[1px] bg-destructive" />
        Problems ({problems.length})
      </div>
      <ScrollArea className="min-h-0 flex-1">
        <ul className="divide-y">
          {problems.map((problem, index) => {
            const clickable = problem.file !== null;
            return (
              <li key={`${problem.file ?? "?"}:${problem.line ?? "?"}:${index}`}>
                <button
                  type="button"
                  disabled={!clickable}
                  onClick={() =>
                    problem.file && onOpenProblem(problem.file, problem.line)
                  }
                  className={cn(
                    "flex w-full items-start gap-2 px-2 py-1.5 text-left text-xs transition-colors",
                    clickable
                      ? "hover:bg-accent hover:shadow-[inset_2px_0_0_0_var(--primary)]"
                      : "cursor-default opacity-80",
                  )}
                >
                  {problem.kind === "error" ? (
                    <CircleAlert className="mt-0.5 size-3.5 shrink-0 text-destructive" />
                  ) : (
                    <AlertTriangle className="mt-0.5 size-3.5 shrink-0 text-yellow-500" />
                  )}
                  <span className="min-w-0">
                    <span className="font-mono text-muted-foreground">
                      {problem.file ?? "log"}
                      {problem.line !== null ? `:${problem.line}` : ""}
                    </span>{" "}
                    <span>{problem.message}</span>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </ScrollArea>
    </div>
  );
}
