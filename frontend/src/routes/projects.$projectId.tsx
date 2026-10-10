import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Group, Panel, Separator } from "react-resizable-panels";
import { FileTree } from "@/components/FileTree";
import { LatexEditor } from "@/components/LatexEditor";
import { useProject } from "@/lib/queries";

export const Route = createFileRoute("/projects/$projectId")({
  component: ProjectPage,
});

function ProjectPage() {
  const { projectId } = Route.useParams();
  const projectQuery = useProject(projectId);
  const [activePath, setActivePath] = useState<string | null>(null);

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
          <div className="flex h-full items-center justify-center p-4 text-center text-sm text-muted-foreground">
            PDF preview arrives in a later step
          </div>
        </Panel>
      </Group>
    </div>
  );
}
