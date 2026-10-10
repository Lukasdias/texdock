import { useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { AnimatePresence } from "motion/react";
import { FolderPlus, Plus } from "lucide-react";
import { toast } from "sonner";
import { ProjectCard } from "@/components/ProjectCard";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useCreateProject, useDeleteProject, useProjects } from "@/lib/queries";
import type { Engine, ProjectOut } from "@/lib/api";

export const Route = createFileRoute("/")({
  component: ProjectsPage,
});

const ENGINES: Engine[] = ["pdflatex", "xelatex", "lualatex"];

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Something went wrong";
}

function ProjectsPage() {
  const navigate = useNavigate();
  const projectsQuery = useProjects();
  const createProject = useCreateProject();
  const deleteProject = useDeleteProject();

  const [createOpen, setCreateOpen] = useState(false);
  const [name, setName] = useState("");
  const [engine, setEngine] = useState<Engine>("pdflatex");
  const [pendingDelete, setPendingDelete] = useState<ProjectOut | null>(null);

  const projects = projectsQuery.data ?? [];

  async function handleCreate() {
    const trimmed = name.trim();
    if (!trimmed) return;
    try {
      const created = await createProject.mutateAsync({
        name: trimmed,
        engine,
      });
      toast.success(`Created “${created.name}”`);
      setCreateOpen(false);
      setName("");
      setEngine("pdflatex");
      await navigate({
        to: "/projects/$projectId",
        params: { projectId: created.id },
      });
    } catch (error) {
      toast.error(errorMessage(error));
    }
  }

  async function handleDelete() {
    if (!pendingDelete) return;
    const target = pendingDelete;
    setPendingDelete(null);
    try {
      await deleteProject.mutateAsync(target.id);
      toast.success(`Deleted “${target.name}”`);
    } catch (error) {
      toast.error(errorMessage(error));
    }
  }

  return (
    <main className="mx-auto max-w-6xl p-6">
      <div className="mb-6 flex items-end justify-between gap-4 border-b border-border pb-4">
        <div>
          <h1 className="font-condensed text-2xl font-bold tracking-[0.12em] uppercase">
            Projects
          </h1>
          <p className="mt-1 font-mono text-[11px] tracking-[0.15em] text-muted-foreground uppercase">
            <span className="text-primary">▚</span> {projects.length}{" "}
            {projects.length === 1 ? "project" : "projects"} · self-hosted
            LaTeX
          </p>
        </div>
        <Button type="button" onClick={() => setCreateOpen(true)}>
          <Plus className="size-4" />
          New project
        </Button>
      </div>

      {projectsQuery.isLoading ? (
        <p className="font-mono text-xs tracking-widest text-muted-foreground uppercase">
          Loading projects…
        </p>
      ) : projectsQuery.isError ? (
        <p className="font-mono text-xs text-destructive uppercase">
          Could not load projects: {errorMessage(projectsQuery.error)}
        </p>
      ) : projects.length === 0 ? (
        <div className="panel-inset flex flex-col items-center justify-center gap-4 rounded-sm border border-dashed border-border py-20 text-center">
          <FolderPlus className="size-9 text-primary" />
          <div className="space-y-1">
            <p className="font-condensed text-sm font-semibold tracking-[0.14em] uppercase">
              No projects yet
            </p>
            <p className="text-sm text-muted-foreground">
              Create your first LaTeX project to get started.
            </p>
          </div>
          <Button type="button" onClick={() => setCreateOpen(true)}>
            <Plus className="size-4" />
            New project
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <AnimatePresence initial={false}>
            {projects.map((project) => (
              <ProjectCard
                key={project.id}
                project={project}
                onOpen={(projectId) =>
                  void navigate({
                    to: "/projects/$projectId",
                    params: { projectId },
                  })
                }
                onDelete={setPendingDelete}
              />
            ))}
          </AnimatePresence>
        </div>
      )}

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New project</DialogTitle>
            <DialogDescription>
              Give the project a name and choose a LaTeX engine.
            </DialogDescription>
          </DialogHeader>
          <form
            className="grid gap-4"
            onSubmit={(event) => {
              event.preventDefault();
              void handleCreate();
            }}
          >
            <div className="grid gap-2">
              <Label htmlFor="project-name">Name</Label>
              <Input
                id="project-name"
                value={name}
                autoFocus
                placeholder="Paper"
                onChange={(event) => setName(event.target.value)}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="project-engine">Engine</Label>
              <Select
                value={engine}
                onValueChange={(value) => setEngine(value as Engine)}
              >
                <SelectTrigger id="project-engine" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ENGINES.map((option) => (
                    <SelectItem key={option} value={option}>
                      {option}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <DialogFooter>
              <Button
                type="submit"
                disabled={name.trim().length === 0 || createProject.isPending}
              >
                Create
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={pendingDelete !== null}
        onOpenChange={(open) => {
          if (!open) setPendingDelete(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete project?</AlertDialogTitle>
            <AlertDialogDescription>
              {pendingDelete
                ? `“${pendingDelete.name}” and all its files will be permanently deleted.`
                : ""}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(event) => {
                event.preventDefault();
                void handleDelete();
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </main>
  );
}
