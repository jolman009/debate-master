"use client";

import { useState } from "react";
import Link from "next/link";
import { UpgradeButton } from "./upgrade-button";
import { ManageButton } from "./manage-button";
import { FREE_DEBATE_LIMIT } from "@/lib/billing/tier";
import { cn } from "@/lib/utils";

interface PricingPlansProps {
  isPremium: boolean;
  inTwa: boolean;
  billingEnabled: boolean;
  hasUser: boolean;
}

const FAQS = [
  {
    question: "Can I cancel or change my plan anytime?",
    answer:
      "Yes. There are no long-term contracts. You can manage, switch, or cancel your subscription at any time with a single click in your account settings.",
  },
  {
    question: "What is the difference between Free and Premium voices?",
    answer:
      "Free debaters use your device's built-in Web Speech synthesis. Premium unlocks studio-quality ElevenLabs neural voices tailored to each archetype's persona, vocal cadence, and accent for an ultra-immersive debate experience.",
  },
  {
    question: "Do I get access to all AI debaters on the Free tier?",
    answer:
      "Yes! All 6 core intellectual archetypes (The Consequentialist, The Logician, The Contrarian, The Presuppositionalist, The Traditionalist, and The Voluntaryist) plus your own custom personas are fully accessible on the Free tier.",
  },
  {
    question: "How does the Deep 4-Dimension Rubric Coaching work?",
    answer:
      "Our AI Coach evaluates your debate turns across Argument Strength, Evidence Usage, Rebuttal Quality, and Rhetorical Skill. Premium includes exact turn quotes, invalid evidence alerts, and auto-generated practice drills targeted at your specific weak spots.",
  },
  {
    question: "Does my subscription work across Web and Android?",
    answer:
      "Yes. Your subscription is linked to your Debate Master account and automatically syncs across our Web app and our Android app.",
  },
];

export function PricingPlans({
  isPremium,
  inTwa,
  billingEnabled,
  hasUser,
}: PricingPlansProps) {
  const [interval, setInterval] = useState<"month" | "year">("month");
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  const toggleFaq = (index: number) => {
    setOpenFaq((prev) => (prev === index ? null : index));
  };

  return (
    <div className="mt-8 space-y-12">
      {/* Billing Interval Toggle (hidden inside TWA where checkout is informational) */}
      {!inTwa && (
        <div className="flex flex-col items-center justify-center gap-3">
          <div className="inline-flex items-center rounded-full border border-stage-border bg-stage-surface p-1 shadow-sm">
            <button
              type="button"
              onClick={() => setInterval("month")}
              className={cn(
                "rounded-full px-4 py-1.5 text-sm font-medium transition-all",
                interval === "month"
                  ? "bg-stage-surface-raised text-stage-text shadow-sm"
                  : "text-stage-muted hover:text-stage-text"
              )}
            >
              Monthly billing
            </button>
            <button
              type="button"
              onClick={() => setInterval("year")}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full px-4 py-1.5 text-sm font-medium transition-all",
                interval === "year"
                  ? "bg-stage-surface-raised text-stage-text shadow-sm"
                  : "text-stage-muted hover:text-stage-text"
              )}
            >
              <span>Annual billing</span>
              <span className="rounded-full bg-stage-accent/20 px-2 py-0.5 text-[11px] font-semibold text-stage-accent">
                Save 40%
              </span>
            </button>
          </div>
        </div>
      )}

      {/* Pricing Cards */}
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        {/* Free Plan */}
        <div className="debate-card relative flex flex-col justify-between rounded-xl border border-stage-border bg-stage-surface p-6 shadow-md transition-all">
          <div>
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold text-stage-text">Free</h2>
              <span className="rounded-full bg-stage-border/60 px-2.5 py-0.5 text-xs font-medium text-stage-muted">
                Starter
              </span>
            </div>
            <p className="mt-1 text-xs text-stage-muted">
              Essential debate sparring and core coaching overview
            </p>

            <div className="mt-5 flex items-baseline gap-1">
              <span className="text-4xl font-extrabold tracking-tight text-stage-text">$0</span>
              <span className="text-sm font-medium text-stage-muted">/ month</span>
            </div>
            <p className="mt-1 text-xs text-stage-muted">Free forever, no credit card required</p>

            <div className="my-6 border-t border-stage-border/60" />

            <ul className="space-y-3 text-sm text-stage-muted">
              <li className="flex items-start gap-2.5">
                <span className="mt-0.5 text-stage-accent font-bold">✓</span>
                <span>
                  <strong className="text-stage-text">{FREE_DEBATE_LIMIT} debates</strong> per month
                </span>
              </li>
              <li className="flex items-start gap-2.5">
                <span className="mt-0.5 text-stage-accent font-bold">✓</span>
                <span>
                  <strong className="text-stage-text">All 6 AI personas</strong> + custom creators
                </span>
              </li>
              <li className="flex items-start gap-2.5">
                <span className="mt-0.5 text-stage-accent font-bold">✓</span>
                <span>Fast browser text-to-speech audio</span>
              </li>
              <li className="flex items-start gap-2.5">
                <span className="mt-0.5 text-stage-accent font-bold">✓</span>
                <span>Curated topic packs & global leaderboard</span>
              </li>
              <li className="flex items-start gap-2.5">
                <span className="mt-0.5 text-stage-accent font-bold">✓</span>
                <span>AI Coach summary score & strength breakdown</span>
              </li>
            </ul>
          </div>

          <div className="mt-8 pt-4 border-t border-stage-border/40">
            {!isPremium ? (
              <div className="rounded-lg bg-stage-surface-raised/80 py-2.5 text-center text-xs font-semibold text-stage-muted border border-stage-border/60">
                Your Current Plan
              </div>
            ) : (
              <div className="text-center text-xs text-stage-muted">Included with account</div>
            )}
          </div>
        </div>

        {/* Premium Plan */}
        <div className="debate-card relative flex flex-col justify-between rounded-xl border-2 border-stage-accent/70 bg-gradient-to-b from-stage-surface via-stage-surface to-stage-accent/5 p-6 shadow-xl shadow-stage-accent/5 transition-all">
          {/* Recommended Tag */}
          <div className="absolute -top-3.5 left-1/2 -translate-x-1/2">
            <span className="rounded-full bg-gradient-to-r from-stage-accent to-amber-500 px-3.5 py-1 text-xs font-bold uppercase tracking-wider text-slate-950 shadow-md">
              ★ Recommended
            </span>
          </div>

          <div>
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold text-stage-text">Premium Pro</h2>
              <span className="rounded-full bg-stage-accent/20 px-2.5 py-0.5 text-xs font-semibold text-stage-accent border border-stage-accent/30">
                Unlimited AI
              </span>
            </div>
            <p className="mt-1 text-xs text-stage-muted">
              Deep rubric analytics, neural voices & unlimited practice
            </p>

            <div className="mt-5 flex items-baseline gap-1.5">
              <span className="text-4xl font-extrabold tracking-tight text-stage-text">
                {interval === "year" ? "$5.99" : "$9.99"}
              </span>
              <span className="text-sm font-medium text-stage-muted">/ month</span>
            </div>
            <p className="mt-1 text-xs text-stage-accent font-medium">
              {interval === "year"
                ? "$69.99 billed annually (save 40%)"
                : "Billed monthly, cancel anytime"}
            </p>

            <div className="my-6 border-t border-stage-border/60" />

            <ul className="space-y-3 text-sm text-stage-muted">
              <li className="flex items-start gap-2.5">
                <span className="mt-0.5 text-stage-accent font-bold">✓</span>
                <span>
                  <strong className="text-stage-text">Unlimited debates</strong> with zero caps
                </span>
              </li>
              <li className="flex items-start gap-2.5">
                <span className="mt-0.5 text-stage-accent font-bold">✓</span>
                <span>
                  <strong className="text-stage-text">ElevenLabs studio voices</strong> for all personas
                </span>
              </li>
              <li className="flex items-start gap-2.5">
                <span className="mt-0.5 text-stage-accent font-bold">✓</span>
                <span>
                  <strong className="text-stage-text">4-Dimension rubric analysis</strong> & turn citations
                </span>
              </li>
              <li className="flex items-start gap-2.5">
                <span className="mt-0.5 text-stage-accent font-bold">✓</span>
                <span>
                  <strong className="text-stage-text">Targeted practice drill generator</strong> tailored to weaknesses
                </span>
              </li>
              <li className="flex items-start gap-2.5">
                <span className="mt-0.5 text-stage-accent font-bold">✓</span>
                <span>Downloadable Coaching Notes in Markdown (<code className="text-xs">.md</code>)</span>
              </li>
              <li className="flex items-start gap-2.5">
                <span className="mt-0.5 text-stage-accent font-bold">✓</span>
                <span>Priority response times on LLM turn generation</span>
              </li>
            </ul>
          </div>

          <div className="mt-8 pt-4 border-t border-stage-border/40">
            {inTwa ? (
              isPremium ? (
                <div className="rounded-lg bg-stage-accent/15 py-2.5 text-center text-sm font-semibold text-stage-accent border border-stage-accent/30">
                  You&apos;re on Premium ✓
                </div>
              ) : (
                <div className="rounded-lg bg-stage-surface-raised py-2.5 text-center text-xs text-stage-muted border border-stage-border">
                  Available through web subscription
                </div>
              )
            ) : !billingEnabled ? (
              <p className="text-center text-xs text-stage-muted">
                Premium billing is coming soon.
              </p>
            ) : !hasUser ? (
              <Link
                href="/login?redirect=/pricing"
                className="btn-primary block w-full text-center py-2.5 text-sm font-semibold"
              >
                Sign in to upgrade
              </Link>
            ) : isPremium ? (
              <div className="space-y-2">
                <div className="rounded-lg bg-stage-accent/15 py-1.5 text-center text-xs font-semibold text-stage-accent border border-stage-accent/30">
                  Active Subscription ✓
                </div>
                <ManageButton />
              </div>
            ) : (
              <UpgradeButton label={`Upgrade to Premium — ${interval === "year" ? "$5.99/mo" : "$9.99/mo"}`} />
            )}
          </div>
        </div>
      </div>

      {/* Trust Badges */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3 pt-4 border-t border-stage-border/40 text-center">
        <div className="rounded-lg bg-stage-surface/50 p-3 border border-stage-border/40">
          <p className="text-xs font-semibold text-stage-text">Cancel Anytime</p>
          <p className="text-[11px] text-stage-muted mt-0.5">One-click cancellation in settings</p>
        </div>
        <div className="rounded-lg bg-stage-surface/50 p-3 border border-stage-border/40">
          <p className="text-xs font-semibold text-stage-text">Instant Activation</p>
          <p className="text-[11px] text-stage-muted mt-0.5">Immediate access to pro features</p>
        </div>
        <div className="rounded-lg bg-stage-surface/50 p-3 border border-stage-border/40">
          <p className="text-xs font-semibold text-stage-text">Secure Payments</p>
          <p className="text-[11px] text-stage-muted mt-0.5">Encrypted 256-bit Stripe checkout</p>
        </div>
      </div>

      {/* FAQ Section */}
      <section className="space-y-4 pt-6">
        <div className="text-center">
          <h2 className="text-xl font-bold text-stage-text">Frequently Asked Questions</h2>
          <p className="text-xs text-stage-muted mt-1">
            Everything you need to know about plans and features
          </p>
        </div>

        <div className="mt-6 divide-y divide-stage-border/60 rounded-xl border border-stage-border bg-stage-surface">
          {FAQS.map((faq, index) => {
            const isOpen = openFaq === index;
            return (
              <div key={faq.question} className="p-4 transition-colors">
                <button
                  type="button"
                  onClick={() => toggleFaq(index)}
                  className="flex w-full items-center justify-between text-left text-sm font-semibold text-stage-text hover:text-stage-accent transition-colors"
                  aria-expanded={isOpen}
                >
                  <span>{faq.question}</span>
                  <span className="ml-3 text-lg font-light text-stage-muted">
                    {isOpen ? "−" : "+"}
                  </span>
                </button>
                {isOpen && (
                  <p className="mt-2 text-xs leading-relaxed text-stage-muted pr-6">
                    {faq.answer}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}
