import Link from "next/link";

export const metadata = {
  title: "Privacy Policy · Debate Master",
  description: "Learn how Debate Master collects, protects, and processes your data.",
};

export default function PrivacyPolicyPage() {
  const lastUpdated = "September 2, 2026";

  return (
    <div className="mx-auto max-w-4xl px-4 py-12 sm:px-6 lg:px-8">
      <div className="border-b border-stage-border pb-8">
        <Link
          href="/"
          className="inline-flex items-center text-xs font-medium text-stage-accent hover:underline mb-4"
        >
          ← Back to Debate Master
        </Link>
        <h1 className="text-3xl font-extrabold tracking-tight text-stage-text sm:text-4xl">
          Privacy Policy
        </h1>
        <p className="mt-2 text-sm text-stage-muted">
          Last updated: {lastUpdated}
        </p>
      </div>

      <div className="mt-8 space-y-10 text-sm leading-relaxed text-stage-muted">
        <section className="space-y-3">
          <h2 className="text-lg font-bold text-stage-text">1. Introduction</h2>
          <p>
            Welcome to Debate Master (&ldquo;we,&rdquo; &ldquo;our,&rdquo; or &ldquo;us&rdquo;). We are committed to
            protecting your personal privacy and providing transparent information regarding how your data
            is collected, processed, and safeguarded when using our web and mobile applications (the &ldquo;Service&rdquo;).
          </p>
          <p>
            By accessing or using Debate Master, you acknowledge that you have read and understood this Privacy Policy.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-bold text-stage-text">2. Information We Collect</h2>
          <p>We collect information to provide, maintain, and improve the debate experience:</p>
          <ul className="list-disc pl-5 space-y-2">
            <li>
              <strong className="text-stage-text">Account Information:</strong> When you create an account,
              we collect your email address and authentication credentials securely managed through Supabase Auth.
            </li>
            <li>
              <strong className="text-stage-text">Debate Content & Input:</strong> Text arguments, motions,
              custom persona configurations, and debate turns you submit during interactive sessions.
            </li>
            <li>
              <strong className="text-stage-text">Coaching & Scoring Records:</strong> AI-generated evaluation
              rubrics, feedback scores, and performance history associated with your profile.
            </li>
            <li>
              <strong className="text-stage-text">Payment & Subscription Data:</strong> When subscribing to Premium,
              payments are securely processed directly by Stripe. We do not store full credit card numbers or banking
              details on our servers.
            </li>
            <li>
              <strong className="text-stage-text">Technical & Usage Telemetry:</strong> Anonymized event telemetry
              (such as feedback helpfulness ratings, feature flag configurations, and session timestamps) used for
              performance monitoring and debugging.
            </li>
          </ul>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-bold text-stage-text">3. How We Use Your Information</h2>
          <p>We use the collected information for the following operational purposes:</p>
          <ul className="list-disc pl-5 space-y-2">
            <li>To operate and render the real-time AI debate stage and generate opponent turns.</li>
            <li>To produce objective coaching rubrics, argument evaluations, and targeted practice recommendations.</li>
            <li>To manage your account, enforce debate tier limits, and process subscription entitlements.</li>
            <li>To ensure security, prevent abusive behavior or hate speech, and resolve platform errors.</li>
          </ul>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-bold text-stage-text">4. AI Processing & Third-Party Service Providers</h2>
          <p>
            Debate Master uses enterprise AI providers to power debate logic and audio synthesis:
          </p>
          <ul className="list-disc pl-5 space-y-2">
            <li>
              <strong className="text-stage-text">Google Gemini API:</strong> Debate turns, motions, and rubric
              evaluations are processed via Google Gemini. Data submitted through the API is processed in accordance
              with Google Cloud enterprise privacy standards and is not used to train third-party public foundation models.
            </li>
            <li>
              <strong className="text-stage-text">ElevenLabs & Web Speech API:</strong> For Premium subscribers,
              AI opponent speech text is sent to ElevenLabs for neural voice generation. Free tier voice playback is
              synthesized locally on your device via the browser&apos;s Web Speech API.
            </li>
            <li>
              <strong className="text-stage-text">Supabase & Cloud Infrastructure:</strong> Database records and authentication
              sessions are securely hosted in encrypted cloud databases.
            </li>
            <li>
              <strong className="text-stage-text">Stripe:</strong> Payment processing, invoice generation, and customer
              portal management.
            </li>
          </ul>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-bold text-stage-text">5. Data Retention, Control & Deletion</h2>
          <p>
            You retain ownership of your personal data. You can delete your custom personas, clear stored session drafts,
            or request complete account deletion and erasure of all associated debate history by contacting our support team
            or through account management options.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-bold text-stage-text">6. Cookies & Client-Side Storage</h2>
          <p>
            We use essential cookies and browser local storage strictly for authentication sessions, dark/light theme
            preferences, draft argument recovery, and trusted web activity detection for mobile applications. We do not
            use third-party tracking cookies or sell your personal information.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-bold text-stage-text">7. Children&apos;s Privacy</h2>
          <p>
            Debate Master is designed for general audiences and educational debate practice. We do not knowingly collect
            or solicit personal identifiable information from children under the age of 13.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-bold text-stage-text">8. Contact Us</h2>
          <p>
            If you have questions, concerns, or requests regarding this Privacy Policy or your personal data, please contact
            us at:
          </p>
          <p className="font-mono text-xs text-stage-text bg-stage-surface p-3 rounded-lg border border-stage-border inline-block">
            privacy@debatemaster.app
          </p>
        </section>
      </div>
    </div>
  );
}
