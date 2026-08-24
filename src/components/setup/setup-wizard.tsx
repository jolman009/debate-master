"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { TopicPicker } from "./topic-picker";
import { PersonaPicker } from "./persona-picker";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  Topic,
  TopicPack,
  Persona,
  PersonaId,
  Difficulty,
  DebateConfig,
  DebateMode,
} from "@/lib/debate/types";

interface SetupWizardProps {
  personas: Persona[];
  topics: Topic[];
  packs: TopicPack[];
  /** Running inside the Android TWA — hide the upgrade link (Play policy). */
  inTwa?: boolean;
}

export function SetupWizard({
  personas,
  topics,
  packs,
  inTwa = false,
}: SetupWizardProps) {
  const router = useRouter();
  const [selectedTopic, setSelectedTopic] = useState<Topic | null>(null);
  const [customTopic, setCustomTopic] = useState("");
  const [selectedPersona, setSelectedPersona] = useState<PersonaId | null>(null);
  const [mode, setMode] = useState<DebateMode>("ai");
  const [userSide, setUserSide] = useState<"pro" | "con">("pro");
  const [difficulty, setDifficulty] = useState<Difficulty>("intermediate");
  const [rebuttalCycles, setRebuttalCycles] = useState<1 | 2>(1);
  const [crossExamEnabled, setCrossExamEnabled] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [upgradeMsg, setUpgradeMsg] = useState<string | null>(null);
  const [createError, setCreateError] = useState<string | null>(null);

  const isHuman = mode === "human";
  const hasTopic = selectedTopic || customTopic.trim().length > 10;
  // Human debates need no persona — the opponent is another person.
  const canStart = hasTopic && (isHuman || selectedPersona);

  async function handleStart() {
    if (!canStart) return;
    setIsCreating(true);
    setUpgradeMsg(null);
    setCreateError(null);

    const topic = selectedTopic?.title || customTopic.trim();
    const motion =
      selectedTopic?.motion ||
      (customTopic.toLowerCase().startsWith("this house")
        ? customTopic.trim()
        : `This house believes that ${customTopic.trim().toLowerCase()}`);

    const config: DebateConfig = {
      topic,
      motion,
      userSide,
      personaId: isHuman ? "" : selectedPersona!,
      difficulty,
      rebuttalCycles,
      crossExamEnabled,
      mode,
    };

    try {
      const res = await fetch("/api/debate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(config),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        if (data.upgrade) {
          setUpgradeMsg(data.error || "You've reached the free limit.");
          setIsCreating(false);
          return;
        }
        throw new Error("Failed to create debate");
      }

      const { debateId } = await res.json();
      router.push(`/debate/${debateId}`);
    } catch (err) {
      console.error("Failed to create debate:", err);
      setCreateError((err as Error).message || "Failed to create debate");
      setIsCreating(false);
    }
  }

  const missingRequirements = !hasTopic
    ? "Choose a topic or enter a custom motion before starting."
    : !isHuman && !selectedPersona
    ? "Choose an AI opponent before starting."
    : null;

  return (
    <div className="max-w-3xl mx-auto px-4 py-8 space-y-8">
      <div className="text-center mb-8">
        <h1 className="text-3xl font-bold mb-2">Set Up Your Debate</h1>
        <p className="text-stage-muted">
          Choose a topic, pick your opponent, and step onto the stage.
        </p>
      </div>

      {/* Opponent mode */}
      <fieldset className="space-y-3">
        <legend className="text-xl font-bold">Opponent</legend>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <label className="block">
            <input
              type="radio"
              name="debate-mode"
              value="ai"
              checked={!isHuman}
              onChange={() => setMode("ai")}
              className="peer sr-only"
            />
            <span className="debate-card block cursor-pointer text-left transition-colors peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-4 peer-focus-visible:outline-stage-focus peer-checked:border-stage-accent peer-checked:ring-1 peer-checked:ring-stage-accent">
              <span className="text-sm font-semibold">AI Persona</span>
              <span className="mt-1 block text-xs text-stage-muted">
                Debate a curated or custom AI simulation right now.
              </span>
            </span>
          </label>
          <label className="block">
            <input
              type="radio"
              name="debate-mode"
              value="human"
              checked={isHuman}
              onChange={() => setMode("human")}
              className="peer sr-only"
            />
            <span className="debate-card block cursor-pointer text-left transition-colors peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-4 peer-focus-visible:outline-stage-focus peer-checked:border-stage-accent peer-checked:ring-1 peer-checked:ring-stage-accent">
              <span className="text-sm font-semibold">A Friend</span>
              <span className="mt-1 block text-xs text-stage-muted">
                Get an invite link and debate another person live.
              </span>
            </span>
          </label>
        </div>
      </fieldset>

      <TopicPicker
        topics={topics}
        packs={packs}
        selectedTopic={selectedTopic}
        customTopic={customTopic}
        onSelectTopic={setSelectedTopic}
        onCustomTopicChange={(val) => {
          setCustomTopic(val);
          setSelectedTopic(null);
        }}
      />

      {!isHuman && (
        <PersonaPicker
          personas={personas}
          selectedPersona={selectedPersona}
          onSelectPersona={setSelectedPersona}
        />
      )}

      {/* Options */}
      <div className="space-y-4">
        <h2 className="text-xl font-bold">Debate Settings</h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Side */}
          <fieldset className="debate-card">
            <legend className="mb-2 block text-sm font-medium">
              Your Side
              {isHuman && (
                <span className="ml-1 font-normal text-xs text-stage-muted">
                  (your friend takes the other)
                </span>
              )}
            </legend>
            <div className="flex gap-2">
              {(["pro", "con"] as const).map((side) => (
                <label key={side} className="flex-1">
                  <input
                    type="radio"
                    name="user-side"
                    value={side}
                    checked={userSide === side}
                    onChange={() => setUserSide(side)}
                    className="peer sr-only"
                  />
                  <span
                    className={cn(
                      "flex min-h-11 cursor-pointer items-center justify-center rounded-lg border px-3 py-2 text-sm font-medium transition-colors peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-4 peer-focus-visible:outline-stage-focus",
                      side === "pro"
                        ? "peer-checked:border-stage-pro/60 peer-checked:bg-stage-pro/15 peer-checked:text-stage-pro"
                        : "peer-checked:border-stage-con/60 peer-checked:bg-stage-con/15 peer-checked:text-stage-con",
                      userSide !== side &&
                        "border-stage-border bg-stage-bg text-stage-muted"
                    )}
                  >
                    {side === "pro" ? "Pro (For)" : "Con (Against)"}
                  </span>
                </label>
              ))}
            </div>
          </fieldset>

          {/* Difficulty */}
          <fieldset className="debate-card">
            <legend className="mb-2 block text-sm font-medium">Difficulty</legend>
            <div className="flex gap-2">
              {(["beginner", "intermediate", "advanced"] as Difficulty[]).map(
                (d) => (
                  <label
                    key={d}
                    className="flex-1"
                  >
                    <input
                      type="radio"
                      name="difficulty"
                      value={d}
                      checked={difficulty === d}
                      onChange={() => setDifficulty(d)}
                      className="peer sr-only"
                    />
                    <span
                      className={cn(
                        "flex min-h-11 cursor-pointer items-center justify-center rounded-lg border px-2 py-2 text-xs font-medium capitalize transition-colors peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-4 peer-focus-visible:outline-stage-focus",
                        difficulty === d
                          ? "border-stage-accent/60 bg-stage-accent/15 text-stage-accent"
                          : "border-stage-border bg-stage-bg text-stage-muted"
                      )}
                    >
                      {d}
                    </span>
                  </label>
                )
              )}
            </div>
          </fieldset>

          {/* Rebuttal Cycles */}
          <fieldset className="debate-card">
            <legend className="mb-2 block text-sm font-medium">
              Rebuttal Rounds
            </legend>
            <div className="flex gap-2">
              {([1, 2] as const).map((n) => (
                <label key={n} className="flex-1">
                  <input
                    type="radio"
                    name="rebuttal-cycles"
                    value={n}
                    checked={rebuttalCycles === n}
                    onChange={() => setRebuttalCycles(n)}
                    className="peer sr-only"
                  />
                  <span
                    className={cn(
                      "flex min-h-11 cursor-pointer items-center justify-center rounded-lg border px-3 py-2 text-sm font-medium transition-colors peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-4 peer-focus-visible:outline-stage-focus",
                      rebuttalCycles === n
                        ? "border-stage-accent/60 bg-stage-accent/15 text-stage-accent"
                        : "border-stage-border bg-stage-bg text-stage-muted"
                    )}
                  >
                    {n} {n === 1 ? "Round" : "Rounds"}
                  </span>
                </label>
              ))}
            </div>
          </fieldset>

          {/* Cross-Examination */}
          <fieldset className="debate-card">
            <legend className="block text-sm font-medium mb-2">
              Cross-Examination
            </legend>
            <label className="block">
              <input
                type="checkbox"
                checked={crossExamEnabled}
                onChange={(e) => setCrossExamEnabled(e.target.checked)}
                className="peer sr-only"
              />
              <span
                className={cn(
                  "flex min-h-11 w-full cursor-pointer items-center justify-center rounded-lg border px-3 py-2 text-sm font-medium transition-colors peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-4 peer-focus-visible:outline-stage-focus",
                  crossExamEnabled
                    ? "border-stage-accent/60 bg-stage-accent/15 text-stage-accent"
                    : "border-stage-border bg-stage-bg text-stage-muted"
                )}
              >
                {crossExamEnabled ? "Enabled" : "Disabled"}
              </span>
            </label>
          </fieldset>
        </div>
      </div>

      {upgradeMsg && (
        <div role="alert" className="rounded-lg border border-stage-accent/40 bg-stage-accent/10 px-4 py-3 text-center text-sm text-stage-text">
          {upgradeMsg}{" "}
          {!inTwa && (
            <Link href="/pricing" className="font-medium text-stage-accent hover:underline">
              View plans
            </Link>
          )}
        </div>
      )}

      {createError && (
        <p role="alert" className="text-center text-sm text-stage-con">
          {createError}
        </p>
      )}

      <p role="status" aria-live="polite" className="text-center text-sm text-stage-muted">
        {missingRequirements ?? (isCreating ? "Creating your debate." : "Ready to start.")}
      </p>

      <div className="flex justify-center pt-4">
        <Button
          size="lg"
          disabled={!canStart || isCreating}
          onClick={handleStart}
        >
          {isCreating
            ? "Creating Debate..."
            : isHuman
            ? "Create Invite Link"
            : "Step Onto the Stage"}
        </Button>
      </div>
    </div>
  );
}
