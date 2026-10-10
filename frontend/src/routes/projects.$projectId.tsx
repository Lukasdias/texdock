import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Group, Panel, Separator } from "react-resizable-panels";
import { toast } from "sonner";
import { FileTree } from "@/components/FileTree";
import { LatexEditor } from "@/components/LatexEditor";
import { PdfViewer } from "@/components/PdfViewer";
import { ProblemsPanel } from "@/components/ProblemsPanel";
import { CompileToolbar } from "@/components/CompileToolbar";
import { api } from "@/lib/api";
import type { CompileStatus } from "@/lib/api";
import { parseProblems } from "@/lib/logparser";
import { useCompileLog, useProject, queryKeys, useCompile } from "@/lib/queries";
import { useCompileSocket } from "@/lib/ws";

export const Route = createFileRoute("/projects/$projectId")({
  component: ProjectPage,
});

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Something went wrong";
}

function ProjectPage() {
  const { projectId } = Route.useParams();
  const queryClient = useQueryClient();

  const projectQuery = useProject(projectId);
  const logQuery = useCompileLog(projectId);
  const compile = useCompile(projectId);
  useCompileSocket(projectId);

  const statusQuery = useQuery<CompileStatus>({
    queryKey: queryKeys.status(projectId),
    queryFn: async () => {
      const log = await api.compile.log(projectId);
      return {
        status: projectQuery.data?.project.last_status ?? "idle",
        problems: log.problems,
        finished_at: null,
      };
    },
    enabled: projectQuery.isSuccess,
    staleTime: Number.POSITIVE_INFINITY,
  });

  const [activePath, setActivePath] = useState<string | null>(null);
  const [revision, setRevision] = useState(0);

  const status = statusQuery.data?.status ?? "idle";
  const finishedAt = statusQuery.data?.finished_at ?? null;

  useEffect(() => {
    if (status === "success") {
      setRevision((value) => value + 1);
    }
  }, [status, finishedAt]);

  if (projectQuery.isLoading) {
    return (
      <p className="p-6 text-sm text-muted-foreground">Loading project…</p>
    );
  }

  if (projectQuery.isError || !projectQuery.data) {
    return (
      <p className="p-6 text-sm text-destructive">
        Could not load this project.
      </p>
    );
  }

  const { project, files } = projectQuery.data;
  const textFilePaths = files
    .filter((file) => !file.is_binary)
    .map((file) => file.path);
  const activeFile = files.find((file) => file.path === activePath);

  const wsProblems = statusQuery.data?.problems ?? [];
  const problems =
    wsProblems.length > 0 ? wsProblems : parseProblems(logQuery.data?.log ?? "");

  function handleCompile() {
    queryClient.setQueryData<CompileStatus>(
      queryKeys.status(projectId),
      (previous) => ({
        status: "queued",
        problems: previous?.problems ?? [],
        finished_at: previous?.finished_at ?? null,
      }),
    );
    compile.mutate(undefined, {
      onError: (error) => toast.error(`Compile failed: ${errorMessage(error)}`),
    });
  }

  function handleOpenProblem(file: string, _line: number | null) {
    if (!files.some((entry) => entry.path === file)) {
      toast.error(`${file} is not part of this project`);
      return;
    }
    setActivePath(file);
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex h-9 shrink-0 items-center gap-2 border-b px-3 text-sm">
        <span className="font-medium">{project.name}</span>
        <span className="text-muted-foreground">· {project.main_file}</span>
      </div>
      <Group orientation="horizontal" className="min-h-0 flex-1">
        <Panel defaultSize="18%" minSize="12%" id="tree" className="min-w-0">
          <FileTree
            projectId={projectId}
            files={files}
            activePath={activePath}
            onSelect={setActivePath}
          />
        </Panel>
        <Separator className="w-px bg-border" />
        <Panel minSize="20%" id="editor" className="min-w-0">
          {activePath && activeFile && !activeFile.is_binary ? (
            <LatexEditor
              key={activePath}
              projectId={projectId}
              path={activePath}
              projectFiles={textFilePaths}
            />
          ) : (
            <div className="flex h-full items-center justify-center p-4 text-center text-sm text-muted-foreground">
              {activePath
                ? `${activePath} is a binary asset — no editor.`
                : "Select a file to edit"}
            </div>
          )}
        </Panel>
        <Separator className="w-px bg-border" />
        <Panel defaultSize="38%" minSize="20%" id="pdf" className="min-w-0">
          <div className="flex h-full flex-col">
            <CompileToolbar
              projectId={projectId}
              status={status}
              problemCount={problems.length}
              onCompile={handleCompile}
              isCompiling={compile.isPending}
            />
            <div className="min-h-0 flex-1 overflow-hidden">
              <PdfViewer
                pdfUrl={api.compile.pdfUrl(projectId)}
                revision={revision}
              />
            </div>
            <ProblemsPanel
              problems={problems}
              onOpenProblem={handleOpenProblem}
            />
          </div>
        </Panel>
      </Group>
    </div>
  );
}
