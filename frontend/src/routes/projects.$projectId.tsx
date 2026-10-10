import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/projects/$projectId")({
  component: ProjectPage,
});

function ProjectPage() {
  const { projectId } = Route.useParams();
  return (
    <main className="p-6">
      <p className="text-sm text-muted-foreground">Project {projectId}</p>
    </main>
  );
}
