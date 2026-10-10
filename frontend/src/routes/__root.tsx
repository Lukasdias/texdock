import { Link, Outlet, createRootRoute } from "@tanstack/react-router";
import { Toaster } from "sonner";
import { BrandLogo } from "@/components/BrandLogo";
import { ThemeToggle } from "@/components/theme-provider";

export const Route = createRootRoute({
  component: RootComponent,
});

function RootComponent() {
  return (
    <div className="flex h-full min-h-screen flex-col text-foreground">
      <header className="panel-sheen relative flex h-14 shrink-0 items-center justify-between border-b border-border px-4">
        <Link
          to="/"
          aria-label="texdock home"
          className="flex items-center gap-2.5 rounded-[1px] transition-colors outline-none hover:text-primary focus-visible:ring-2 focus-visible:ring-ring"
        >
          <BrandLogo className="h-5 w-auto" />
        </Link>
        <div className="flex items-center gap-3">
          <span className="hidden items-center gap-3 sm:flex">
            <span className="h-4 w-px bg-border" />
            <span className="font-mono text-[10px] tracking-[0.2em] text-muted-foreground uppercase">
              loopback
            </span>
          </span>
          <ThemeToggle />
        </div>
      </header>
      <div className="min-h-0 flex-1">
        <Outlet />
      </div>
      <Toaster richColors position="bottom-right" />
    </div>
  );
}
