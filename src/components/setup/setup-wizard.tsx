"use client";

import { useEffect, useMemo, useState } from "react";
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
import { trackEvent } from "@/lib/analytics";

interface SetupWizardProps {
  personas: Persona[];
  topics: Topic[];
  packs: TopicPack[];
  /** Running inside the Android TWA - hide the upgrade link (Play policy). */
  inTwa?: boolean;
  initialCustomTopic?: string;
  initialDifficulty?: Difficulty;
  initialCoachingGoal?: string;
}

type WizardStep = "format" | "motion" | "opponent" | "review";

interface StoredSetupState {
  version: 1;
  step: WizardStep;
  selectedTopicId: string | null;
  customTopic: string;
  selectedPersona: PersonaId | null;
  mode: DebateMode;
  userSide: "pro" | "con";
  difficulty: Difficulty;
  rebuttalCycles: 1 | 2;
  crossExamEnabled: boolean;
}

const STORAGE_KEY = "debate-master.setup.v1";
const STORAGE_VERSION = 1;

const ALL_STEPS: { id: WizardStep; label: string }[] = [
  { id: "format", label: "Format" },
  { id: "motion", label: "Motion" },
  { id: "opponent", label: "Opponent" },
  { id: "review", label: "Review" },
];

export function SetupWizard({
  personas,
  topics,
  packs,
  inTwa = false,
  initialCustomTopic = "",
  initialDifficulty,
  initialCoachingGoal,
}: SetupWizardProps) {
  const router = useRouter();
  const [step, setStep] = useState<WizardStep>("format");
  const [selectedTopic, setSelectedTopic] = useState<Topic | null>(null);
  const [customTopic, setCustomTopic] = useState(initialCustomTopic);
  const [selectedPersona, setSelectedPersona] = useState<PersonaId | null>(null);
  const [mode, setMode] = useState<DebateMode>("ai");
  const [userSide, setUserSide] = useState<"pro" | "con">("pro");
  const [difficulty, setDifficulty] = useState<Difficulty>(
    initialDifficulty ?? "intermediate"
  );
  const [rebuttalCycles, setRebuttalCycles] = useState<1 | 2>(1);
  const [crossExamEnabled, setCrossExamEnabled] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [upgradeMsg, setUpgradeMsg] = useState<string | null>(null);
  const [createError, setCreateError] = useState<string | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const [stepMessage, setStepMessage] = useState("Step 1 of 4: Format.");

  const isHuman = mode === "human";
  const visibleSteps = useMemo(
    () => ALL_STEPS.filter((item) => item.id !== "opponent" || !isHuman),
    [isHuman]
  );
  const currentIndex = Math.max(
    0,
    visibleSteps.findIndex((item) => item.id === step)
  );
  const selectedPersonaObject =
    personas.find((persona) => persona.id === selectedPersona) ?? null;
  const customMotion = customTopic.trim();
  const hasTopic = !!selectedTopic || customMotion.length > 10;
  const canStart = hasTopic && (isHuman || !!selectedPersona);
  const selectedMotionLabel = selectedTopic?.title || customMotion || "Not selected";
  const selectedMotionText =
    selectedTopic?.motion ||
    (customMotion
      ? customMotion.toLowerCase().startsWith("this house")
        ? customMotion
        : `This house believes that ${customMotion.toLowerCase()}`
      : "");

  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(STORAGE_KEY);
      if (!raw) {
        if (initialCustomTopic) {
          setStep("motion");
          setCustomTopic(initialCustomTopic);
          setDifficulty(initialDifficulty ?? "intermediate");
        }
        setHydrated(true);
        return;
      }

      const parsed = JSON.parse(raw) as StoredSetupState;
      if (parsed.version !== STORAGE_VERSION) {
        sessionStorage.removeItem(STORAGE_KEY);
        setHydrated(true);
        return;
      }

      const restoredTopic =
        parsed.selectedTopicId != null
          ? topics.find((topic) => topic.id === parsed.selectedTopicId) ?? null
          : null;
      const personaExists =
        parsed.selectedPersona != null &&
        personas.some((persona) => persona.id === parsed.selectedPersona);

      setMode(parsed.mode === "human" ? "human" : "ai");
      setUserSide(parsed.userSide === "con" ? "con" : "pro");
      setDifficulty(
        ["beginner", "intermediate", "advanced"].includes(parsed.difficulty)
          ? parsed.difficulty
          : "intermediate"
      );
      setRebuttalCycles(parsed.rebuttalCycles === 2 ? 2 : 1);
      setCrossExamEnabled(Boolean(parsed.crossExamEnabled));
      setSelectedTopic(restoredTopic);
      setCustomTopic(restoredTopic ? "" : parsed.customTopic || "");
      setSelectedPersona(personaExists ? parsed.selectedPersona : null);
      setStep(
        parsed.step === "opponent" && parsed.mode === "human"
          ? "review"
          : parsed.step
      );
    } catch {
      sessionStorage.removeItem(STORAGE_KEY);
    } finally {
      setHydrated(true);
    }
  }, [initialCustomTopic, initialDifficulty, personas, topics]);

  useEffect(() => {
    if (!hydrated) return;
    if (isHuman && step === "opponent") {
      setStep("review");
      return;
    }

    const payload: StoredSetupState = {
      version: STORAGE_VERSION,
      step,
      selectedTopicId: selectedTopic?.id ?? null,
      customTopic,
      selectedPersona,
      mode,
      userSide,
      difficulty,
      rebuttalCycles,
      crossExamEnabled,
    };

    try {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
    } catch {}
  }, [
    hydrated,
    step,
    selectedTopic,
    customTopic,
    selectedPersona,
    mode,
    userSide,
    difficulty,
    rebuttalCycles,
    crossExamEnabled,
    isHuman,
  ]);

  useEffect(() => {
    const visibleStep = visibleSteps[currentIndex];
    setStepMessage(
      `Step ${currentIndex + 1} of ${visibleSteps.length}: ${visibleStep.label}.`
    );
    if (hydrated) {
      trackEvent("setup_step_viewed", { step, mode });
    }
  }, [currentIndex, visibleSteps, hydrated, step, mode]);

  async function handleStart() {
    if (!canStart) return;
    setIsCreating(true);
    setUpgradeMsg(null);
    setCreateError(null);

    const config: DebateConfig = {
      topic: selectedTopic?.title || customMotion,
      motion: selectedMotionText,
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

      sessionStorage.removeItem(STORAGE_KEY);
      const { debateId } = await res.json();
      trackEvent("setup_completed", {
        mode,
        topic: selectedTopic?.title || customMotion,
        personaId: selectedPersona ?? undefined,
        difficulty,
      });
      trackEvent("debate_started", { debateId, mode });
      router.push(`/debate/${debateId}`);
    } catch (err) {
      console.error("Failed to create debate:", err);
      setCreateError((err as Error).message || "Failed to create debate");
      setIsCreating(false);
    }
  }

  function getStepRequirement() {
    if (step === "motion" && !hasTopic) {
      return "Choose a motion or enter a custom motion before continuing.";
    }
    if (step === "opponent" && !isHuman && !selectedPersona) {
      return "Choose an AI opponent before continuing.";
    }
    if (step === "review" && !canStart) {
      return !hasTopic
        ? "Choose a motion before starting."
        : "Choose an AI opponent before starting.";
    }
    return null;
  }

  function goNext() {
    const requirement = getStepRequirement();
    if (requirement) {
      setStepMessage(requirement);
      return;
    }
    const next = visibleSteps[currentIndex + 1]?.id;
    if (next) setStep(next);
  }

  function goBack() {
    const previous = visibleSteps[currentIndex - 1]?.id;
    if (previous) setStep(previous);
  }

  const atReview = step === "review";
  const requirement = getStepRequirement();

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <div className="mb-8">
        <p className="text-sm font-medium text-stage-accent">New debate</p>
        <h1 className="mt-1 text-3xl font-bold">Set Up Your Debate</h1>
        <p className="mt-2 max-w-2xl text-stage-muted">
          Work through the format, motion, opponent, and review choices in order.
        </p>
        {initialCoachingGoal && (
          <div className="mt-3 flex items-center gap-2 rounded-lg border border-stage-warning/40 bg-stage-warning/10 p-3 text-xs sm:text-sm text-stage-text">
            <span className="font-semibold text-stage-warning">Targeted Drill Focus:</span>
            <span>{initialCoachingGoal}</span>
            <span className="ml-auto text-[11px] text-stage-muted">Calibrated to {difficulty}</span>
          </div>
        )}
      </div>

      <ol className="mb-8 grid grid-cols-3 gap-2 sm:grid-cols-4" aria-label="Setup progress">
        {visibleSteps.map((item, index) => {
          const active = item.id === step;
          const complete = index < currentIndex;
          return (
            <li key={item.id}>
              <button
                type="button"
                onClick={() => setStep(item.id)}
                aria-current={active ? "step" : undefined}
                className={cn(
                  "flex min-h-11 w-full items-center justify-center rounded-lg border px-2 text-sm font-medium transition-colors",
                  active
                    ? "border-stage-accent bg-stage-accent text-stage-on-accent"
                    : complete
                    ? "border-stage-accent/40 bg-stage-accent/10 text-stage-accent"
                    : "border-stage-border bg-stage-surface text-stage-muted hover:text-stage-text"
                )}
              >
                {index + 1}. {item.label}
              </button>
            </li>
          );
        })}
      </ol>

      <div role="status" aria-live="polite" className="sr-only">
        {stepMessage}
      </div>

      <section className="min-h-[28rem]">
        {step === "format" && (
          <FormatStep
            mode={mode}
            userSide={userSide}
            onModeChange={setMode}
            onSideChange={setUserSide}
          />
        )}

        {step === "motion" && (
          <TopicPicker
            topics={topics}
            packs={packs}
            selectedTopic={selectedTopic}
            customTopic={customTopic}
            onSelectTopic={(topic) => {
              setSelectedTopic(topic);
              if (topic) setCustomTopic("");
              setStepMessage(topic ? `Selected ${topic.title}.` : "Motion cleared.");
            }}
            onCustomTopicChange={(val) => {
              setCustomTopic(val);
              setSelectedTopic(null);
            }}
            coachingGoal={initialCoachingGoal}
          />
        )}

        {step === "opponent" && !isHuman && (
          <PersonaPicker
            personas={personas}
            selectedPersona={selectedPersona}
            onSelectPersona={(id) => {
              setSelectedPersona(id);
              const persona = personas.find((item) => item.id === id);
              setStepMessage(
                persona ? `Selected ${persona.displayName}.` : "Opponent selected."
              );
            }}
          />
        )}

        {atReview && (
          <ReviewStep
            mode={mode}
            motionLabel={selectedMotionLabel}
            motionText={selectedMotionText}
            userSide={userSide}
            persona={selectedPersonaObject}
            difficulty={difficulty}
            rebuttalCycles={rebuttalCycles}
            crossExamEnabled={crossExamEnabled}
            coachingGoal={initialCoachingGoal}
            onDifficultyChange={setDifficulty}
            onRebuttalCyclesChange={setRebuttalCycles}
            onCrossExamChange={setCrossExamEnabled}
            onEdit={setStep}
          />
        )}
      </section>

      {upgradeMsg && (
        <div role="alert" className="mt-6 rounded-lg border border-stage-accent/40 bg-stage-accent/10 px-4 py-3 text-center text-sm text-stage-text">
          {upgradeMsg}{" "}
          {!inTwa && (
            <Link href="/pricing" className="font-medium text-stage-accent hover:underline">
              View plans
            </Link>
          )}
        </div>
      )}

      {createError && (
        <p role="alert" className="mt-6 text-center text-sm text-stage-con">
          {createError}
        </p>
      )}

      <div className="sticky bottom-[var(--nav-bottom-inset)] z-20 mt-8 border-t border-stage-border bg-stage-bg/95 py-4 backdrop-blur">
        {requirement && (
          <p role="status" aria-live="polite" className="mb-3 text-center text-sm text-stage-muted">
            {requirement}
          </p>
        )}
        <div className="flex items-center justify-between gap-3">
          <Button
            type="button"
            variant="secondary"
            onClick={goBack}
            disabled={currentIndex === 0 || isCreating}
          >
            Back
          </Button>
          {atReview ? (
            <Button
              type="button"
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
          ) : (
            <Button type="button" size="lg" onClick={goNext}>
              Continue
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

function FormatStep({
  mode,
  userSide,
  onModeChange,
  onSideChange,
}: {
  mode: DebateMode;
  userSide: "pro" | "con";
  onModeChange: (mode: DebateMode) => void;
  onSideChange: (side: "pro" | "con") => void;
}) {
  const isHuman = mode === "human";
  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-bold">Format</h2>
        <p className="mt-1 text-sm text-stage-muted">
          Choose who you are debating and which side you will argue.
        </p>
      </div>

      <fieldset className="space-y-3">
        <legend className="text-sm font-semibold">Opponent type</legend>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <ChoiceLabel
            name="debate-mode"
            value="ai"
            checked={!isHuman}
            onChange={() => onModeChange("ai")}
            title="AI Persona"
            description="Practice immediately with an AI simulation."
          />
          <ChoiceLabel
            name="debate-mode"
            value="human"
            checked={isHuman}
            onChange={() => onModeChange("human")}
            title="A Friend"
            description="Create an invite link and debate live."
          />
        </div>
      </fieldset>

      <fieldset className="space-y-3">
        <legend className="text-sm font-semibold">
          Your side
          {isHuman && (
            <span className="ml-1 font-normal text-stage-muted">
              (your friend takes the other)
            </span>
          )}
        </legend>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <ChoiceLabel
            name="user-side"
            value="pro"
            checked={userSide === "pro"}
            onChange={() => onSideChange("pro")}
            title="Pro"
            description="Argue for the motion."
            tone="pro"
          />
          <ChoiceLabel
            name="user-side"
            value="con"
            checked={userSide === "con"}
            onChange={() => onSideChange("con")}
            title="Con"
            description="Argue against the motion."
            tone="con"
          />
        </div>
      </fieldset>
    </div>
  );
}

function ReviewStep({
  mode,
  motionLabel,
  motionText,
  userSide,
  persona,
  difficulty,
  rebuttalCycles,
  crossExamEnabled,
  coachingGoal,
  onDifficultyChange,
  onRebuttalCyclesChange,
  onCrossExamChange,
  onEdit,
}: {
  mode: DebateMode;
  motionLabel: string;
  motionText: string;
  userSide: "pro" | "con";
  persona: Persona | null;
  difficulty: Difficulty;
  rebuttalCycles: 1 | 2;
  crossExamEnabled: boolean;
  coachingGoal?: string;
  onDifficultyChange: (difficulty: Difficulty) => void;
  onRebuttalCyclesChange: (cycles: 1 | 2) => void;
  onCrossExamChange: (enabled: boolean) => void;
  onEdit: (step: WizardStep) => void;
}) {
  const isHuman = mode === "human";
  const estimatedTurns =
    2 + rebuttalCycles * 2 + (crossExamEnabled ? 2 : 0) + 2;

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-bold">Review</h2>
        <p className="mt-1 text-sm text-stage-muted">
          Confirm the debate structure before creation.
        </p>
      </div>

      <dl className="divide-y divide-stage-border rounded-lg border border-stage-border bg-stage-surface">
        {coachingGoal && (
          <ReviewRow label="Practice focus" value={coachingGoal} />
        )}
        <ReviewRow label="Format" value={isHuman ? "Friend debate" : "AI practice"} onEdit={() => onEdit("format")} />
        <ReviewRow
          label="Motion"
          value={motionLabel}
          detail={motionText}
          onEdit={() => onEdit("motion")}
        />
        <ReviewRow label="Your side" value={userSide === "pro" ? "Pro" : "Con"} onEdit={() => onEdit("format")} />
        <ReviewRow
          label="Opponent"
          value={isHuman ? "Invite link for a friend" : persona?.displayName ?? "Not selected"}
          detail={!isHuman && persona ? "AI simulation" : undefined}
          onEdit={() => onEdit(isHuman ? "format" : "opponent")}
        />
        <ReviewRow
          label="Structure"
          value={`${estimatedTurns} turns estimated`}
          detail={`${rebuttalCycles} rebuttal ${rebuttalCycles === 1 ? "round" : "rounds"}${
            crossExamEnabled ? ", with cross-examination" : ", no cross-examination"
          }`}
        />
      </dl>

      <details className="rounded-lg border border-stage-border bg-stage-surface p-4">
        <summary className="cursor-pointer text-sm font-semibold">
          Customize format
        </summary>
        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <fieldset>
            <legend className="mb-2 text-sm font-medium">Difficulty</legend>
            <div className="flex gap-2">
              {(["beginner", "intermediate", "advanced"] as Difficulty[]).map((item) => (
                <SegmentLabel
                  key={item}
                  name="difficulty"
                  value={item}
                  checked={difficulty === item}
                  onChange={() => onDifficultyChange(item)}
                  label={item}
                />
              ))}
            </div>
          </fieldset>

          <fieldset>
            <legend className="mb-2 text-sm font-medium">Rebuttal rounds</legend>
            <div className="flex gap-2">
              {([1, 2] as const).map((item) => (
                <SegmentLabel
                  key={item}
                  name="rebuttal-cycles"
                  value={String(item)}
                  checked={rebuttalCycles === item}
                  onChange={() => onRebuttalCyclesChange(item)}
                  label={item === 1 ? "1 round" : "2 rounds"}
                />
              ))}
            </div>
          </fieldset>

          <fieldset className="sm:col-span-2">
            <legend className="mb-2 text-sm font-medium">Cross-examination</legend>
            <label className="block max-w-xs">
              <input
                type="checkbox"
                checked={crossExamEnabled}
                onChange={(event) => onCrossExamChange(event.target.checked)}
                className="peer sr-only"
              />
              <span
                className={cn(
                  "flex min-h-11 cursor-pointer items-center justify-center rounded-lg border px-3 py-2 text-sm font-medium transition-colors peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-4 peer-focus-visible:outline-stage-focus",
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
      </details>
    </div>
  );
}

function ChoiceLabel({
  name,
  value,
  checked,
  onChange,
  title,
  description,
  tone = "accent",
}: {
  name: string;
  value: string;
  checked: boolean;
  onChange: () => void;
  title: string;
  description: string;
  tone?: "accent" | "pro" | "con";
}) {
  const toneClass =
    tone === "pro"
      ? "peer-checked:border-stage-pro/60 peer-checked:bg-stage-pro/15 peer-checked:text-stage-pro"
      : tone === "con"
      ? "peer-checked:border-stage-con/60 peer-checked:bg-stage-con/15 peer-checked:text-stage-con"
      : "peer-checked:border-stage-accent peer-checked:bg-stage-accent/10 peer-checked:text-stage-accent";

  return (
    <label className="block">
      <input
        type="radio"
        name={name}
        value={value}
        checked={checked}
        onChange={onChange}
        className="peer sr-only"
      />
      <span
        className={cn(
          "block min-h-28 cursor-pointer rounded-lg border border-stage-border bg-stage-surface p-4 transition-colors peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-4 peer-focus-visible:outline-stage-focus",
          toneClass
        )}
      >
        <span className="block text-sm font-semibold">{title}</span>
        <span className="mt-1 block text-sm text-stage-muted">{description}</span>
      </span>
    </label>
  );
}

function SegmentLabel({
  name,
  value,
  checked,
  onChange,
  label,
}: {
  name: string;
  value: string;
  checked: boolean;
  onChange: () => void;
  label: string;
}) {
  return (
    <label className="flex-1">
      <input
        type="radio"
        name={name}
        value={value}
        checked={checked}
        onChange={onChange}
        className="peer sr-only"
      />
      <span
        className={cn(
          "flex min-h-11 cursor-pointer items-center justify-center rounded-lg border px-2 py-2 text-center text-xs font-medium capitalize transition-colors peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-4 peer-focus-visible:outline-stage-focus",
          checked
            ? "border-stage-accent/60 bg-stage-accent/15 text-stage-accent"
            : "border-stage-border bg-stage-bg text-stage-muted"
        )}
      >
        {label}
      </span>
    </label>
  );
}

function ReviewRow({
  label,
  value,
  detail,
  onEdit,
}: {
  label: string;
  value: string;
  detail?: string;
  onEdit?: () => void;
}) {
  return (
    <div className="grid grid-cols-[7rem_1fr_auto] gap-3 px-4 py-3 text-sm">
      <dt className="text-stage-muted">{label}</dt>
      <dd className="min-w-0">
        <p className="font-medium text-stage-text">{value}</p>
        {detail && <p className="mt-0.5 text-xs text-stage-muted">{detail}</p>}
      </dd>
      {onEdit && (
        <button
          type="button"
          onClick={onEdit}
          className="min-h-11 rounded-lg px-2 text-sm font-medium text-stage-accent hover:text-stage-accent-hover"
        >
          Edit
        </button>
      )}
    </div>
  );
}
