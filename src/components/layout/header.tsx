import Link from "next/link";

export function Header() {
  return (
    <header className="border-b border-stage-border px-6 py-4">
      <nav className="max-w-5xl mx-auto flex items-center justify-between">
        <Link href="/" className="text-xl font-bold text-white">
          Debate<span className="text-stage-accent">Master</span>
        </Link>
        <div className="flex gap-6 text-sm text-stage-muted">
          <Link href="/debate/new" className="hover:text-white transition-colors">
            New Debate
          </Link>
        </div>
      </nav>
    </header>
  );
}
