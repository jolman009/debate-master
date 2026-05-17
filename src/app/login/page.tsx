import { LoginForm } from "@/components/auth/login-form";

export const metadata = {
  title: "Sign in · Debate Master",
};

export default function LoginPage({
  searchParams,
}: {
  searchParams: { redirect?: string; error?: string };
}) {
  return (
    <div className="flex flex-col items-center justify-center px-4 py-16">
      <LoginForm
        redirectTo={searchParams.redirect ?? "/"}
        initialError={
          searchParams.error === "confirm"
            ? "Email confirmation failed or expired. Please sign in again."
            : null
        }
      />
    </div>
  );
}
