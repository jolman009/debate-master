import { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { FeedbackForm } from "./feedback-form";

export const metadata: Metadata = {
  title: "Feedback & Support | Debate Master",
  description: "Send feedback, feature suggestions, or bug reports to the Debate Master engineering team.",
};

export default function FeedbackPage() {
  return (
    <main className="min-h-screen bg-stage-bg text-stage-text py-12 px-4 sm:px-6 lg:px-8 flex flex-col justify-center">
      <div className="mx-auto max-w-xl w-full space-y-6">
        {/* Header Branding */}
        <div className="text-center space-y-3">
          <Link href="/" className="inline-flex items-center gap-2.5 group">
            <div className="relative flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-stage-surface border border-stage-border group-hover:scale-105 transition-transform">
              <Image
                src="/brand/debate-master-crest.png"
                alt="Debate Master"
                width={32}
                height={29}
                className="h-7 w-auto object-contain dark:hidden"
              />
              <Image
                src="/brand/debate-master-crest-dark.png"
                alt="Debate Master"
                width={32}
                height={29}
                className="hidden h-7 w-auto object-contain dark:block drop-shadow-[0_0_8px_rgba(184,141,76,0.35)]"
              />
            </div>
            <span className="font-editorial text-2xl font-bold tracking-tight text-stage-text">
              Debate<span className="text-stage-accent">Master</span>
            </span>
          </Link>
          <h1 className="font-editorial text-3xl font-bold tracking-tight text-stage-text">
            Feedback & Support
          </h1>
          <p className="text-sm text-stage-muted max-w-md mx-auto">
            We actively monitor feedback to improve AI reasoning depth, judge fairness, speech audio, and app features.
          </p>
        </div>

        {/* Feedback Card */}
        <div className="rounded-2xl border border-stage-border bg-stage-surface/70 p-6 sm:p-8 shadow-xl backdrop-blur-sm">
          <FeedbackForm />
        </div>

        {/* Footer Support Info */}
        <div className="text-center space-y-2 text-xs text-stage-muted">
          <p>
            For urgent privacy inquiries, see our{" "}
            <Link href="/privacy" className="text-stage-accent hover:underline">
              Privacy Policy
            </Link>{" "}
            or email us directly at{" "}
            <a href="mailto:support@debatemaster.app" className="text-stage-text font-mono underline">
              support@debatemaster.app
            </a>.
          </p>
        </div>
      </div>
    </main>
  );
}
