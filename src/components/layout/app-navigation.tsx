"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  NavItem,
  PRODUCT_NAV_ITEMS,
  navItemActive,
  navItemVisible,
} from "@/lib/navigation";
import { getSupabaseClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import { ThemeToggle } from "@/components/ui/theme-toggle";

interface AppNavigationProps {
  email: string | null;
  inTwa: boolean;
}

type IconName = "practice" | "new" | "library" | "leaderboard" | "profile";

const BOTTOM_ICONS: Record<string, IconName> = {
  "/debate": "practice",
  "/debate/new": "new",
  "/personas": "library",
  "/leaderboard": "leaderboard",
};

export function AppNavigation({ email, inTwa }: AppNavigationProps) {
  const pathname = usePathname();
  const signedIn = !!email;
  const isLiveDebateRoute =
    pathname.startsWith("/debate/") &&
    pathname !== "/debate/new" &&
    !pathname.startsWith("/debate/join/");
  const navItems = PRODUCT_NAV_ITEMS.filter((item) =>
    navItemVisible(item, signedIn, inTwa)
  );
  const desktopItems = navItems.filter((item) => item.href !== "/pricing");
  const bottomItems = navItems
    .filter((item) => ["/debate", "/debate/new", "/personas", "/leaderboard"].includes(item.href))
    .slice(0, 4);

  if (isLiveDebateRoute) {
    return null;
  }

  return (
    <>
      <header className="border-b border-stage-border bg-stage-bg/95 px-4 py-3 backdrop-blur supports-[backdrop-filter]:bg-stage-bg/80">
        <nav className="mx-auto flex max-w-5xl items-center justify-between gap-4">
          <Link href={signedIn ? "/debate" : "/"} className="min-h-11 inline-flex items-center text-xl font-bold text-stage-text">
            Debate<span className="text-stage-accent">Master</span>
          </Link>

          <div className="hidden items-center gap-1 md:flex">
            {desktopItems.map((item) => (
              <NavLink key={item.href} item={item} pathname={pathname} />
            ))}
          </div>

          <div className="hidden items-center gap-2 md:flex">
            {!inTwa && (
              <NavLink
                item={{ href: "/pricing", label: "Pricing", match: "prefix" }}
                pathname={pathname}
              />
            )}
            <ProfileMenu email={email} />
          </div>

          <div className="flex items-center gap-2 md:hidden">
            {!signedIn && (
              <Link
                href="/leaderboard"
                className={cn(
                  "min-h-11 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                  pathname.startsWith("/leaderboard")
                    ? "bg-stage-surface text-stage-text"
                    : "text-stage-muted hover:text-stage-text"
                )}
              >
                Leaderboard
              </Link>
            )}
            <ProfileMenu email={email} compact />
          </div>
        </nav>
      </header>

      {signedIn && (
        <nav
          data-bottom-nav
          aria-label="Primary"
          className="fixed inset-x-0 bottom-0 z-40 border-t border-stage-border bg-stage-bg/95 px-2 pb-[calc(env(safe-area-inset-bottom)+0.35rem)] pt-1.5 backdrop-blur supports-[backdrop-filter]:bg-stage-bg/85 md:hidden"
        >
          <div className="mx-auto grid max-w-md grid-cols-5 items-end gap-1">
            {bottomItems.map((item) => (
              <BottomNavLink
                key={item.href}
                item={item}
                pathname={pathname}
                icon={BOTTOM_ICONS[item.href] ?? "practice"}
              />
            ))}
            <ProfileMenu email={email} bottom />
          </div>
        </nav>
      )}
    </>
  );
}

function NavLink({ item, pathname }: { item: NavItem; pathname: string }) {
  const active = navItemActive(pathname, item);
  return (
    <Link
      href={item.href}
      aria-current={active ? "page" : undefined}
      className={cn(
        "inline-flex min-h-11 items-center rounded-lg px-3 py-2 text-sm font-medium transition-colors",
        active
          ? "bg-stage-surface text-stage-text"
          : "text-stage-muted hover:bg-stage-surface/70 hover:text-stage-text"
      )}
    >
      {item.label}
    </Link>
  );
}

function BottomNavLink({
  item,
  pathname,
  icon,
}: {
  item: NavItem;
  pathname: string;
  icon: IconName;
}) {
  const active = navItemActive(pathname, item);
  return (
    <Link
      href={item.href}
      aria-current={active ? "page" : undefined}
      className={cn(
        "flex min-h-14 flex-col items-center justify-center rounded-lg px-1 text-[11px] font-medium transition-colors",
        active
          ? "bg-stage-surface text-stage-accent"
          : "text-stage-muted hover:bg-stage-surface/70 hover:text-stage-text",
        item.href === "/debate/new" &&
          "relative -mt-3 bg-stage-accent text-stage-on-accent shadow-lg shadow-stage-accent/20 hover:bg-stage-accent-hover hover:text-stage-on-accent",
        active && item.href === "/debate/new" && "text-stage-on-accent"
      )}
    >
      <Icon name={icon} className="mb-0.5 h-5 w-5" />
      <span className="max-w-full truncate">{item.href === "/debate/new" ? "New" : item.label}</span>
    </Link>
  );
}

function ProfileMenu({
  email,
  compact = false,
  bottom = false,
}: {
  email: string | null;
  compact?: boolean;
  bottom?: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const initials = useMemo(() => {
    if (!email) return "?";
    return email.slice(0, 1).toUpperCase();
  }, [email]);

  useEffect(() => {
    if (!open) return;

    const previousFocus = document.activeElement as HTMLElement | null;
    const firstFocusable = menuRef.current?.querySelector<HTMLElement>(
      "a, button, [tabindex]:not([tabindex='-1'])"
    );
    firstFocusable?.focus();

    function closeAndRestore() {
      setOpen(false);
      (previousFocus ?? buttonRef.current)?.focus?.();
    }

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        closeAndRestore();
      }
      if (event.key !== "Tab" || !menuRef.current) return;

      const focusable = Array.from(
        menuRef.current.querySelectorAll<HTMLElement>(
          "a, button, [tabindex]:not([tabindex='-1'])"
        )
      ).filter((node) => !node.hasAttribute("disabled"));
      if (focusable.length === 0) return;

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    function onPointerDown(event: PointerEvent) {
      const target = event.target as Node;
      if (menuRef.current?.contains(target) || buttonRef.current?.contains(target)) {
        return;
      }
      closeAndRestore();
    }

    document.addEventListener("keydown", onKeyDown);
    document.addEventListener("pointerdown", onPointerDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("pointerdown", onPointerDown);
    };
  }, [open]);

  async function signOut() {
    setLoading(true);
    await getSupabaseClient().auth.signOut();
    setOpen(false);
    router.push("/");
    router.refresh();
  }

  if (!email) {
    return (
      <Link
        href="/login"
        className="inline-flex min-h-11 items-center rounded-lg px-3 py-2 text-sm font-medium text-stage-muted transition-colors hover:bg-stage-surface/70 hover:text-stage-text"
      >
        Sign in
      </Link>
    );
  }

  return (
    <div className={cn("relative", bottom && "flex justify-center")}>
      <button
        ref={buttonRef}
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
        className={cn(
          "inline-flex min-h-11 min-w-11 items-center justify-center gap-2 rounded-lg text-sm font-medium text-stage-muted transition-colors hover:bg-stage-surface/70 hover:text-stage-text",
          bottom && "flex min-h-14 w-full flex-col px-1 text-[11px]",
          compact ? "px-2" : "px-3"
        )}
      >
        {bottom ? (
          <>
            <Icon name="profile" className="mb-0.5 h-5 w-5" />
            <span>Profile</span>
          </>
        ) : (
          <>
            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-stage-surface-raised text-xs font-bold text-stage-text">
              {initials}
            </span>
            <span className={cn("max-w-[10rem] truncate", compact && "sr-only")}>
              Profile
            </span>
          </>
        )}
      </button>

      {open && (
        <div
          ref={menuRef}
          role="menu"
          className={cn(
            "absolute z-50 w-64 rounded-lg border border-stage-border bg-stage-surface p-2 shadow-xl shadow-black/10",
            bottom
              ? "bottom-[calc(100%+0.75rem)] right-0"
              : "right-0 top-[calc(100%+0.5rem)]"
          )}
        >
          <div className="border-b border-stage-border px-2 py-2">
            <p className="truncate text-sm font-medium text-stage-text">{email}</p>
            <p className="text-xs text-stage-muted">Account</p>
          </div>
          <Link
            href="/personas"
            role="menuitem"
            onClick={() => setOpen(false)}
            className="mt-2 flex min-h-11 items-center rounded-md px-2 text-sm text-stage-muted hover:bg-stage-bg hover:text-stage-text"
          >
            Persona library
          </Link>
          <div className="flex min-h-11 items-center justify-between rounded-md px-2">
            <span className="text-sm text-stage-muted">Theme</span>
            <ThemeToggle />
          </div>
          <button
            type="button"
            role="menuitem"
            onClick={signOut}
            disabled={loading}
            className="flex min-h-11 w-full items-center rounded-md px-2 text-left text-sm text-stage-muted hover:bg-stage-bg hover:text-stage-text disabled:opacity-60"
          >
            {loading ? "Signing out..." : "Sign out"}
          </button>
        </div>
      )}
    </div>
  );
}

function Icon({
  name,
  className,
}: {
  name: IconName;
  className?: string;
}) {
  const common = {
    className,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 2,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true,
  };

  if (name === "new") {
    return (
      <svg {...common}>
        <path d="M12 5v14" />
        <path d="M5 12h14" />
      </svg>
    );
  }
  if (name === "library") {
    return (
      <svg {...common}>
        <path d="M4 19.5V5a2 2 0 0 1 2-2h11" />
        <path d="M8 7h10a2 2 0 0 1 2 2v10H8a2 2 0 0 1 0-4h12" />
      </svg>
    );
  }
  if (name === "leaderboard") {
    return (
      <svg {...common}>
        <path d="M7 20V10" />
        <path d="M12 20V4" />
        <path d="M17 20v-7" />
      </svg>
    );
  }
  if (name === "profile") {
    return (
      <svg {...common}>
        <circle cx="12" cy="8" r="4" />
        <path d="M4 21a8 8 0 0 1 16 0" />
      </svg>
    );
  }
  return (
    <svg {...common}>
      <path d="M4 5h16" />
      <path d="M6 12h12" />
      <path d="M8 19h8" />
    </svg>
  );
}
