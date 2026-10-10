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
      <Card className="group h-full transition-colors hover:border-ring">
        <CardHeader className="flex-row items-start justify-between gap-2">
          <button
            type="button"
            onClick={() => onOpen(project.id)}
            className="min-w-0 text-left"
          >
            <span className="flex items-center gap-2">
              <FileText className="size-4 shrink-0 text-muted-foreground" />
              <span className="truncate font-medium">{project.name}</span>
            </span>
          </button>
          <Badge variant={statusVariant}>{status ?? "no compiles"}</Badge>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          <p className="truncate">
            {project.main_file} · {project.engine}
          </p>
          <p className="mt-1">Updated {formatUpdated(project.updated_at)}</p>
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
