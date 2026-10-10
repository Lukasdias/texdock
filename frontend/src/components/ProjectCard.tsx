import { FileText, Trash2 } from "lucide-react";
import { motion } from "motion/react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import type { ProjectOut } from "@/lib/api";

interface ProjectCardProps {
  project: ProjectOut;
  onOpen: (projectId: string) => void;
  onDelete: (project: ProjectOut) => void;
}

type BadgeVariant = "default" | "secondary" | "destructive" | "outline";

const STATUS_VARIANT: Record<string, BadgeVariant> = {
  success: "default",
  running: "secondary",
  queued: "secondary",
  error: "destructive",
};

function formatUpdated(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleString();
}

export function ProjectCard({ project, onOpen, onDelete }: ProjectCardProps) {
  const status = project.last_status;
  const statusVariant: BadgeVariant = status
    ? (STATUS_VARIANT[status] ?? "outline")
    : "outline";

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.96 }}
      transition={{ duration: 0.15 }}
    >
      <Card className="group panel-sheen relative h-full overflow-hidden rounded-sm border-border transition-colors hover:border-primary/60">
        <span
          aria-hidden
          className="absolute inset-x-0 top-0 h-[3px] bg-border transition-colors group-hover:bg-primary"
        />
        <span aria-hidden className="rivet absolute top-3 left-3 size-1.5" />
        <span aria-hidden className="rivet absolute top-3 right-3 size-1.5" />
        <CardHeader className="flex-row items-start justify-between gap-2">
          <button
            type="button"
            onClick={() => onOpen(project.id)}
            className="min-w-0 text-left"
          >
            <span className="flex items-center gap-2">
              <FileText className="size-4 shrink-0 text-primary" />
              <span className="truncate font-condensed text-sm font-semibold tracking-[0.06em] uppercase">
                {project.name}
              </span>
            </span>
          </button>
          <Badge variant={statusVariant}>{status ?? "no compiles"}</Badge>
        </CardHeader>
        <CardContent className="font-mono text-xs text-muted-foreground">
          <p className="truncate">
            {project.main_file} · {project.engine}
          </p>
          <p className="mt-1">updated {formatUpdated(project.updated_at)}</p>
        </CardContent>
        <CardFooter className="justify-between gap-2">
          <Button
            type="button"
            size="sm"
            variant="secondary"
            onClick={() => onOpen(project.id)}
          >
            Open
          </Button>
          <Button
            type="button"
            size="icon-sm"
            variant="ghost"
            aria-label={`Delete ${project.name}`}
            onClick={() => onDelete(project)}
          >
            <Trash2 className="size-4" />
          </Button>
        </CardFooter>
      </Card>
    </motion.div>
  );
}
