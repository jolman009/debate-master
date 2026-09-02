"use client";

import Image from "next/image";
import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { getSupabaseClient, clearStaleAuthCookies } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";

type Mode = "signin" | "signup";

interface LoginFormProps {
  redirectTo: string;
  initialError: string | null;
}

export function LoginForm({ redirectTo, initialError }: LoginFormProps) {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(initialError);
  const [notice, setNotice] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // Clear out any obsolete/bloated auth cookies or chunks on login screen
    clearStaleAuthCookies();
  }, []);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setNotice(null);

    if (password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }

    setLoading(true);
    clearStaleAuthCookies();
    const supabase = getSupabaseClient();

    try {
      if (mode === "signin") {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (error) throw error;
        router.push(redirectTo);
        router.refresh();
      } else {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
        });
        if (error) throw error;
        if (data.session) {
          // Email confirmation is disabled — signed in immediately.
          router.push(redirectTo);
          router.refresh();
        } else {
          setNotice(
            "Account created. Check your email to confirm, then sign in."
          );
          setMode("signin");
        }
      }
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="debate-card w-full max-w-sm">
      <div className="mb-4 flex items-center gap-3">
        <Image
          src="/brand/app-icon-dark.svg"
          alt="Debate Master"
          width={40}
          height={40}
          className="rounded-xl shadow-sm shrink-0"
        />
        <div>
          <h1 className="text-xl font-bold text-stage-text">
            {mode === "signin" ? "Sign in" : "Create your account"}
          </h1>
          <p className="text-xs text-stage-muted">Debate Master Arena</p>
        </div>
      </div>
      <p className="mb-4 text-xs text-stage-muted">
        {mode === "signin"
          ? "Welcome back to the debate stage."
          : "Start sharpening your rhetorical skills."}
      </p>

      <form onSubmit={onSubmit} className="mt-5 space-y-3">
        <div>
          <label htmlFor="email" className="text-xs font-medium text-stage-muted">
            Email
          </label>
          <input
            id="email"
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="mt-1 min-h-11 w-full rounded-lg border border-stage-border bg-stage-surface px-3 py-2 text-sm text-stage-text outline-none focus:border-stage-accent"
          />
        </div>
        <div>
          <label
            htmlFor="password"
            className="text-xs font-medium text-stage-muted"
          >
            Password
          </label>
          <input
            id="password"
            type="password"
            required
            autoComplete={
              mode === "signin" ? "current-password" : "new-password"
            }
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="mt-1 min-h-11 w-full rounded-lg border border-stage-border bg-stage-surface px-3 py-2 text-sm text-stage-text outline-none focus:border-stage-accent"
          />
        </div>

        {error && <p role="alert" className="text-sm text-stage-con">{error}</p>}
        {notice && (
          <p role="status" aria-live="polite" className="text-sm text-stage-pro">
            {notice}
          </p>
        )}

        <Button type="submit" disabled={loading} className="w-full">
          {loading
            ? "Please wait…"
            : mode === "signin"
            ? "Sign in"
            : "Create account"}
        </Button>
      </form>

      <div className="mt-4 flex flex-col items-center gap-2 text-center text-sm">
        <button
          type="button"
          onClick={() => {
            setMode(mode === "signin" ? "signup" : "signin");
            setError(null);
            setNotice(null);
          }}
          className="text-stage-muted transition-colors hover:text-stage-text"
        >
          {mode === "signin"
            ? "Need an account? Create one"
            : "Already have an account? Sign in"}
        </button>
        <button
          type="button"
          onClick={() => {
            clearStaleAuthCookies();
            try {
              localStorage.clear();
              sessionStorage.clear();
            } catch {}
            setNotice("Session cookies cleared.");
          }}
          className="text-xs text-stage-muted/60 transition-colors hover:text-stage-muted hover:underline"
        >
          Clear stuck session / cookies
        </button>
      </div>

      <p className="mt-6 text-center text-[11px] text-stage-muted border-t border-stage-border/60 pt-4">
        By continuing, you agree to our{" "}
        <Link href="/terms" className="text-stage-text underline hover:text-stage-accent">
          Terms of Service
        </Link>{" "}
        and{" "}
        <Link href="/privacy" className="text-stage-text underline hover:text-stage-accent">
          Privacy Policy
        </Link>
        .
      </p>
    </div>
  );
}
