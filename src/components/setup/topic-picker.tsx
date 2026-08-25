"use client";

import { useId, useMemo, useRef, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Topic, TopicPack } from "@/lib/debate/types";
import { cn } from "@/lib/utils";

interface TopicPickerProps {
  topics: Topic[];
  packs: TopicPack[];
  selectedTopic: Topic | null;
  customTopic: string;
  onSelectTopic: (topic: Topic | null) => void;
  onCustomTopicChange: (value: string) => void;
  coachingGoal?: string;
}

const CATEGORIES = [
  { id: "all", label: "All" },
  { id: "politics", label: "Politics" },
  { id: "economics", label: "Economics" },
  { id: "technology", label: "Technology" },
  { id: "social", label: "Social" },
  { id: "philosophy", label: "Philosophy" },
];

export function TopicPicker({
  topics,
  packs,
  selectedTopic,
  customTopic,
  onSelectTopic,
  onCustomTopicChange,
  coachingGoal,
}: TopicPickerProps) {
  const searchId = useId();
  const customTopicId = useId();
  const customTopicHelpId = useId();
  const customRef = useRef<HTMLTextAreaElement>(null);
  const [query, setQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState("all");
  const [activePackId, setActivePackId] = useState<string>("all");

  const activePack =
    activePackId === "all" ? null : packs.find((p) => p.id === activePackId);
  const normalizedQuery = query.trim().toLowerCase();
  const customLength = customTopic.trim().length;
  const customValid = customLength > 10;

  const filteredTopics = useMemo(() => {
    return topics.filter((topic) => {
      const packMatches = activePack ? topic.packId === activePack.id : true;
      const categoryMatches =
        activePack || activeCategory === "all"
          ? true
          : topic.category === activeCategory;
      const queryMatches =
        normalizedQuery.length === 0 ||
        `${topic.title} ${topic.motion}`.toLowerCase().includes(normalizedQuery);
      return packMatches && categoryMatches && queryMatches;
    });
  }, [activeCategory, activePack, normalizedQuery, topics]);

  const recommendedTopics = useMemo(() => {
    if (normalizedQuery) return [];
    const preferred = topics.filter((topic) =>
      ["beginner", "intermediate"].includes(topic.difficulty)
    );
    return preferred.slice(0, 4);
  }, [normalizedQuery, topics]);

  const remainingTopics = filteredTopics.filter(
    (topic) => !recommendedTopics.some((item) => item.id === topic.id)
  );

  function focusCustomMotion() {
    customRef.current?.focus();
  }

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-bold">Motion</h2>
        <p className="mt-1 text-sm text-stage-muted">
          Search the catalogue or write a motion for this debate.
        </p>
        {coachingGoal && (
          <p className="mt-2 text-sm text-stage-muted">
            Practice focus: {coachingGoal}
          </p>
        )}
      </div>

      <div className="space-y-3">
        <label htmlFor={searchId} className="text-sm font-semibold">
          Search motions
        </label>
        <input
          id={searchId}
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search by title or motion"
          className="min-h-11 w-full rounded-lg border border-stage-border bg-stage-surface px-4 py-2 text-sm text-stage-text placeholder:text-stage-muted/70"
        />

        <details className="rounded-lg border border-stage-border bg-stage-surface p-3">
          <summary className="cursor-pointer text-sm font-semibold">
            Filters
          </summary>
          <div className="mt-4 space-y-4">
            {packs.length > 0 && (
              <fieldset>
                <legend className="mb-2 text-xs font-semibold uppercase text-stage-muted">
                  Packs
                </legend>
                <div className="flex flex-wrap gap-2">
                  <FilterButton
                    label="All Topics"
                    pressed={activePackId === "all"}
                    onClick={() => setActivePackId("all")}
                  />
                  {packs.map((pack) => (
                    <FilterButton
                      key={pack.id}
                      label={pack.name}
                      pressed={activePackId === pack.id}
                      onClick={() => setActivePackId(pack.id)}
                    />
                  ))}
                </div>
              </fieldset>
            )}

            {!activePack && (
              <fieldset>
                <legend className="mb-2 text-xs font-semibold uppercase text-stage-muted">
                  Category
                </legend>
                <div className="flex flex-wrap gap-2">
                  {CATEGORIES.map((category) => (
                    <FilterButton
                      key={category.id}
                      label={category.label}
                      pressed={activeCategory === category.id}
                      onClick={() => setActiveCategory(category.id)}
                      rounded
                    />
                  ))}
                </div>
              </fieldset>
            )}

            {activePack?.description && (
              <p className="text-sm text-stage-muted">{activePack.description}</p>
            )}
          </div>
        </details>
      </div>

      {recommendedTopics.length > 0 && (
        <MotionGroup
          title="Recommended motions"
          topics={recommendedTopics}
          selectedTopic={selectedTopic}
          onSelectTopic={onSelectTopic}
        />
      )}

      {remainingTopics.length > 0 ? (
        <MotionGroup
          title={normalizedQuery ? "Search results" : "Motion catalogue"}
          topics={remainingTopics}
          selectedTopic={selectedTopic}
          onSelectTopic={onSelectTopic}
        />
      ) : (
        <div className="rounded-lg border border-stage-border bg-stage-surface px-4 py-5">
          <p className="text-sm font-medium text-stage-text">No matching motions</p>
          <p className="mt-1 text-sm text-stage-muted">
            Write a custom motion instead.
          </p>
          <button
            type="button"
            onClick={focusCustomMotion}
            className="mt-3 min-h-11 rounded-lg px-3 text-sm font-medium text-stage-accent hover:text-stage-accent-hover"
          >
            Use custom motion
          </button>
        </div>
      )}

      <div className="space-y-2 rounded-lg border border-stage-border bg-stage-surface p-4">
        <label htmlFor={customTopicId} className="text-sm font-semibold">
          Custom motion
        </label>
        <Textarea
          ref={customRef}
          id={customTopicId}
          placeholder="This house believes that..."
          value={customTopic}
          onChange={(event) => {
            onCustomTopicChange(event.target.value);
            onSelectTopic(null);
          }}
          aria-describedby={customTopicHelpId}
          rows={3}
        />
        <p
          id={customTopicHelpId}
          className={cn(
            "text-xs",
            customTopic.length > 0 && !customValid
              ? "text-stage-warning"
              : "text-stage-muted"
          )}
        >
          {customTopic.length === 0
            ? "Use a clear motion that can be argued from both sides."
            : `${customLength} characters. ${
                customValid
                  ? "Custom motion is ready."
                  : "Add a little more detail to continue."
              }`}
        </p>
      </div>
    </div>
  );
}

function MotionGroup({
  title,
  topics,
  selectedTopic,
  onSelectTopic,
}: {
  title: string;
  topics: Topic[];
  selectedTopic: Topic | null;
  onSelectTopic: (topic: Topic | null) => void;
}) {
  return (
    <fieldset>
      <legend className="mb-3 text-sm font-semibold">{title}</legend>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {topics.map((topic) => (
          <label key={topic.id} className="block">
            <input
              type="radio"
              name="debate-topic"
              value={topic.id}
              checked={selectedTopic?.id === topic.id}
              onChange={() => onSelectTopic(topic)}
              className="peer sr-only"
            />
            <span className="block min-h-32 cursor-pointer rounded-lg border border-stage-border bg-stage-surface p-4 transition-all duration-200 hover:border-stage-accent/50 peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-4 peer-focus-visible:outline-stage-focus peer-checked:border-stage-accent peer-checked:ring-1 peer-checked:ring-stage-accent peer-checked:shadow-lg peer-checked:shadow-stage-accent/10">
              <span className="flex items-start justify-between gap-2">
                <span className="text-sm font-semibold">{topic.title}</span>
                <Badge>{topic.difficulty}</Badge>
              </span>
              <span className="mt-2 line-clamp-3 text-xs text-stage-muted">
                {topic.motion}
              </span>
            </span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}

function FilterButton({
  label,
  pressed,
  onClick,
  rounded = false,
}: {
  label: string;
  pressed: boolean;
  onClick: () => void;
  rounded?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={pressed}
      className={cn(
        "min-h-11 px-3 py-2 text-sm font-medium transition-colors",
        rounded ? "rounded-full" : "rounded-lg",
        pressed
          ? "bg-stage-accent text-stage-on-accent"
          : "bg-stage-bg text-stage-muted hover:text-stage-text"
      )}
    >
      {label}
    </button>
  );
}
