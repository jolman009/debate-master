"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { getSupabaseClient } from "@/lib/supabase/client";
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

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setNotice(null);

    if (password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }

    setLoading(true);
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
      <h1 className="text-xl font-bold text-stage-text">
        {mode === "signin" ? "Sign in" : "Create your account"}
      </h1>
      <p className="mt-1 text-sm text-stage-muted">
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
            className="mt-1 w-full rounded-lg border border-stage-border bg-stage-surface px-3 py-2 text-sm text-stage-text outline-none focus:border-stage-accent"
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
            className="mt-1 w-full rounded-lg border border-stage-border bg-stage-surface px-3 py-2 text-sm text-stage-text outline-none focus:border-stage-accent"
          />
        </div>

        {error && <p className="text-sm text-stage-con">{error}</p>}
        {notice && <p className="text-sm text-stage-pro">{notice}</p>}

        <Button type="submit" disabled={loading} className="w-full">
          {loading
            ? "Please wait…"
            : mode === "signin"
            ? "Sign in"
            : "Create account"}
        </Button>
      </form>

      <button
        type="button"
        onClick={() => {
          setMode(mode === "signin" ? "signup" : "signin");
          setError(null);
          setNotice(null);
        }}
        className="mt-4 text-sm text-stage-muted transition-colors hover:text-stage-text"
      >
        {mode === "signin"
          ? "Need an account? Create one"
          : "Already have an account? Sign in"}
      </button>
    </div>
  );
}
