import { Download, Loader2, Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { api } from "@/lib/api";

interface CompileToolbarProps {
  projectId: string;
  status: string;
  problemCount: number;
  onCompile: () => void;
  isCompiling: boolean;
}

type BadgeVariant = "default" | "secondary" | "destructive" | "outline";

const STATUS_VARIANT: Record<string, BadgeVariant> = {
  success: "default",
  running: "secondary",
  queued: "secondary",
  error: "destructive",
  idle: "outline",
};

export function CompileToolbar({
  projectId,
  status,
  problemCount,
  onCompile,
  isCompiling,
}: CompileToolbarProps) {
  const variant = STATUS_VARIANT[status] ?? "outline";
  const busy = isCompiling || status === "queued" || status === "running";

  return (
    <div className="flex h-9 shrink-0 items-center gap-2 border-b px-2">
      <Button
        type="button"
        size="sm"
        variant="secondary"
        onClick={onCompile}
        disabled={busy}
      >
        {busy ? (
          <Loader2 className="size-4 animate-spin" />
        ) : (
          <Play className="size-4" />
        )}
        Compile
      </Button>
      <Button asChild size="sm" variant="ghost">
        <a href={api.compile.pdfUrl(projectId, true)}>
          <Download className="size-4" />
          Download
        </a>
      </Button>
      <div className="ml-auto flex items-center gap-2">
        {problemCount > 0 ? (
          <Badge variant="destructive">{problemCount} problems</Badge>
        ) : null}
        <Badge variant={variant}>{status}</Badge>
      </div>
    </div>
  );
}
