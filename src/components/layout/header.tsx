import Link from "next/link";
import { ThemeToggle } from "@/components/ui/theme-toggle";

export function Header() {
  return (
    <header className="border-b border-stage-border px-6 py-4">
      <nav className="max-w-5xl mx-auto flex items-center justify-between">
        <Link href="/" className="text-xl font-bold text-stage-text">
          Debate<span className="text-stage-accent">Master</span>
        </Link>
        <div className="flex items-center gap-6">
          <Link
            href="/debate/new"
            className="text-sm text-stage-muted hover:text-stage-text transition-colors"
          >
            New Debate
          </Link>
          <ThemeToggle />
        </div>
      </nav>
    </header>
  );
}
