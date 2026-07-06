import { LoginForm } from "@/components/auth/login-form";

export const metadata = {
  title: "Sign in · Debate Master",
};

// Where to send the user after a successful sign-in. Default to their
// dashboard (not the marketing landing page, which reads as "nothing
// happened"). Only honor internal, absolute paths so a crafted
// `?redirect=https://evil.com` (or protocol-relative `//evil.com`) can't
// bounce the user off-site.
function resolveRedirect(target: string | undefined): string {
  if (target && target.startsWith("/") && !target.startsWith("//")) {
    return target;
  }
  return "/debate";
}

export default function LoginPage({
  searchParams,
}: {
  searchParams: { redirect?: string; error?: string };
}) {
  return (
    <div className="flex flex-col items-center justify-center px-4 py-16">
      <LoginForm
        redirectTo={resolveRedirect(searchParams.redirect)}
        initialError={
          searchParams.error === "confirm"
            ? "Email confirmation failed or expired. Please sign in again."
            : null
        }
      />
    </div>
  );
}
