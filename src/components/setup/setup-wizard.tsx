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

  const isHuman = mode === "human";
  const hasTopic = selectedTopic || customTopic.trim().length > 10;
  // Human debates need no persona — the opponent is another person.
  const canStart = hasTopic && (isHuman || selectedPersona);

  async function handleStart() {
    if (!canStart) return;
    setIsCreating(true);
    setUpgradeMsg(null);

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
      setIsCreating(false);
    }
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-8 space-y-8">
      <div className="text-center mb-8">
        <h1 className="text-3xl font-bold mb-2">Set Up Your Debate</h1>
        <p className="text-stage-muted">
          Choose a topic, pick your opponent, and step onto the stage.
        </p>
      </div>

      {/* Opponent mode */}
      <div className="space-y-3">
        <h2 className="text-xl font-bold">Opponent</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <button
            type="button"
            onClick={() => setMode("ai")}
            className={cn(
              "debate-card text-left transition-colors",
              !isHuman
                ? "border-stage-accent/60 ring-1 ring-stage-accent/40"
                : "opacity-70 hover:opacity-100"
            )}
          >
            <p className="font-semibold text-sm">AI Persona</p>
            <p className="text-xs text-stage-muted mt-1">
              Debate a curated or custom AI opponent right now.
            </p>
          </button>
          <button
            type="button"
            onClick={() => setMode("human")}
            className={cn(
              "debate-card text-left transition-colors",
              isHuman
                ? "border-stage-accent/60 ring-1 ring-stage-accent/40"
                : "opacity-70 hover:opacity-100"
            )}
          >
            <p className="font-semibold text-sm">A Friend</p>
            <p className="text-xs text-stage-muted mt-1">
              Get an invite link and debate another person live.
            </p>
          </button>
        </div>
      </div>

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
          <div className="debate-card">
            <label className="block text-sm font-medium mb-2">
              Your Side
              {isHuman && (
                <span className="ml-1 font-normal text-xs text-stage-muted">
                  (your friend takes the other)
                </span>
              )}
            </label>
            <div className="flex gap-2">
              <button
                onClick={() => setUserSide("pro")}
                className={cn(
                  "flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-colors",
                  userSide === "pro"
                    ? "bg-stage-pro/20 text-stage-pro border border-stage-pro/50"
                    : "bg-stage-bg text-stage-muted border border-stage-border"
                )}
              >
                Pro (For)
              </button>
              <button
                onClick={() => setUserSide("con")}
                className={cn(
                  "flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-colors",
                  userSide === "con"
                    ? "bg-stage-con/20 text-stage-con border border-stage-con/50"
                    : "bg-stage-bg text-stage-muted border border-stage-border"
                )}
              >
                Con (Against)
              </button>
            </div>
          </div>

          {/* Difficulty */}
          <div className="debate-card">
            <label className="block text-sm font-medium mb-2">Difficulty</label>
            <div className="flex gap-2">
              {(["beginner", "intermediate", "advanced"] as Difficulty[]).map(
                (d) => (
                  <button
                    key={d}
                    onClick={() => setDifficulty(d)}
                    className={cn(
                      "flex-1 py-2 px-2 rounded-lg text-xs font-medium capitalize transition-colors",
                      difficulty === d
                        ? "bg-stage-accent/20 text-stage-accent border border-stage-accent/50"
                        : "bg-stage-bg text-stage-muted border border-stage-border"
                    )}
                  >
                    {d}
                  </button>
                )
              )}
            </div>
          </div>

          {/* Rebuttal Cycles */}
          <div className="debate-card">
            <label className="block text-sm font-medium mb-2">
              Rebuttal Rounds
            </label>
            <div className="flex gap-2">
              {([1, 2] as const).map((n) => (
                <button
                  key={n}
                  onClick={() => setRebuttalCycles(n)}
                  className={cn(
                    "flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-colors",
                    rebuttalCycles === n
                      ? "bg-stage-accent/20 text-stage-accent border border-stage-accent/50"
                      : "bg-stage-bg text-stage-muted border border-stage-border"
                  )}
                >
                  {n} {n === 1 ? "Round" : "Rounds"}
                </button>
              ))}
            </div>
          </div>

          {/* Cross-Examination */}
          <div className="debate-card">
            <label className="block text-sm font-medium mb-2">
              Cross-Examination
            </label>
            <button
              onClick={() => setCrossExamEnabled(!crossExamEnabled)}
              className={cn(
                "w-full py-2 px-3 rounded-lg text-sm font-medium transition-colors",
                crossExamEnabled
                  ? "bg-stage-accent/20 text-stage-accent border border-stage-accent/50"
                  : "bg-stage-bg text-stage-muted border border-stage-border"
              )}
            >
              {crossExamEnabled ? "Enabled" : "Disabled"}
            </button>
          </div>
        </div>
      </div>

      {upgradeMsg && (
        <div className="rounded-lg border border-stage-accent/40 bg-stage-accent/10 px-4 py-3 text-center text-sm text-stage-text">
          {upgradeMsg}{" "}
          {!inTwa && (
            <Link href="/pricing" className="font-medium text-stage-accent hover:underline">
              View plans →
            </Link>
          )}
        </div>
      )}

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
