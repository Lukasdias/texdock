import { Link, Outlet, createRootRoute } from "@tanstack/react-router";
import { Toaster } from "sonner";
import { ThemeToggle } from "@/components/theme-provider";

export const Route = createRootRoute({
  component: RootComponent,
});

function RootComponent() {
  return (
    <div className="flex h-full min-h-screen flex-col bg-background text-foreground">
      <header className="flex h-12 shrink-0 items-center justify-between border-b px-4">
        <Link to="/" className="text-sm font-semibold tracking-tight">
          texdock
        </Link>
        <ThemeToggle />
      </header>
      <div className="min-h-0 flex-1">
        <Outlet />
      </div>
      <Toaster richColors position="bottom-right" />
    </div>
  );
}
