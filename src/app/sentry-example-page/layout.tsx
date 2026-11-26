import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Sentry monitoring test — Debate Master",
  description: "Verify browser and server error capture in Sentry.",
};

export default function SentryTestLayout({ children }: { children: React.ReactNode }) {
  return children;
}
