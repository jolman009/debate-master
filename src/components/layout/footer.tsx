"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";

export function Footer() {
  const pathname = usePathname();
  const isLiveDebateRoute =
    pathname.startsWith("/debate/") &&
    pathname !== "/debate/new" &&
    !pathname.startsWith("/debate/join/");

  if (isLiveDebateRoute) {
    return null;
  }

  return (
    <footer className="border-t border-stage-border bg-stage-bg px-4 py-10 pb-24 sm:px-6 sm:pb-12 lg:px-8">
      <div className="mx-auto max-w-6xl">
        <div className="grid grid-cols-1 gap-8 md:grid-cols-4">
          {/* Brand Col */}
          <div className="md:col-span-2 space-y-3">
            <Link
              href="/"
              className="font-editorial inline-flex items-center gap-2 text-xl font-semibold text-stage-text group"
            >
              <Image
                src="/brand/logo-mark.svg"
                alt="Debate Master Logo"
                width={28}
                height={25}
                className="shrink-0 transition-transform group-hover:scale-105"
              />
              <span>Debate<span className="text-stage-accent">Master</span></span>
            </Link>
            <p className="text-xs leading-relaxed text-stage-muted max-w-sm">
              An AI-powered sparring arena and speech coaching platform. Sharpen your rhetoric,
              test arguments against distinct intellectual archetypes, and receive evidence-based feedback.
            </p>
            <p className="text-[11px] text-stage-muted/80">
              AI characters are fictional simulations for educational and practice purposes.
            </p>
          </div>

          {/* Navigation */}
          <div className="space-y-3">
            <p className="text-xs font-semibold uppercase tracking-wider text-stage-text">
              Platform
            </p>
            <ul className="space-y-2 text-xs text-stage-muted">
              <li>
                <Link href="/debate/new" className="hover:text-stage-accent transition-colors">
                  Start Debate
                </Link>
              </li>
              <li>
                <Link href="/personas" className="hover:text-stage-accent transition-colors">
                  AI Personas
                </Link>
              </li>
              <li>
                <Link href="/leaderboard" className="hover:text-stage-accent transition-colors">
                  Leaderboard
                </Link>
              </li>
              <li>
                <Link href="/pricing" className="hover:text-stage-accent transition-colors">
                  Plans & Pricing
                </Link>
              </li>
            </ul>
          </div>

          {/* Legal */}
          <div className="space-y-3">
            <p className="text-xs font-semibold uppercase tracking-wider text-stage-text">
              Legal & Privacy
            </p>
            <ul className="space-y-2 text-xs text-stage-muted">
              <li>
                <Link href="/privacy" className="hover:text-stage-accent transition-colors">
                  Privacy Policy
                </Link>
              </li>
              <li>
                <Link href="/terms" className="hover:text-stage-accent transition-colors">
                  Terms of Service
                </Link>
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-8 pt-6 border-t border-stage-border/60 flex flex-col sm:flex-row items-center justify-between gap-4 text-[11px] text-stage-muted">
          <p>© {new Date().getFullYear()} Debate Master. All rights reserved.</p>
          <div className="flex items-center gap-4">
            <Link href="/privacy" className="hover:underline">
              Privacy
            </Link>
            <span>·</span>
            <Link href="/terms" className="hover:underline">
              Terms
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
