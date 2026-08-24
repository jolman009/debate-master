"use client";

import { useId, useState } from "react";
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
}: TopicPickerProps) {
  const customTopicId = useId();
  const topicGroupLabelId = useId();
  const customTopicHelpId = useId();
  const [activeCategory, setActiveCategory] = useState("all");
  const [activePackId, setActivePackId] = useState<string>("all");
  const [useCustom, setUseCustom] = useState(false);

  const activePack =
    activePackId === "all" ? null : packs.find((p) => p.id === activePackId);

  // Within a specific pack, show that pack's topics; in "All" mode, filter by
  // the category chips instead.
  const filteredTopics = activePack
    ? topics.filter((t) => t.packId === activePack.id)
    : activeCategory === "all"
    ? topics
    : topics.filter((t) => t.category === activeCategory);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold">Choose a Topic</h2>
        <button
          type="button"
          onClick={() => {
            setUseCustom(!useCustom);
            if (!useCustom) onSelectTopic(null);
          }}
          aria-pressed={useCustom}
          className="touch-target rounded-lg px-2 text-sm font-medium text-stage-accent transition-colors hover:text-stage-accent-hover"
        >
          {useCustom ? "Pick from list" : "Custom topic"}
        </button>
      </div>

      {useCustom ? (
        <div className="space-y-2">
          <label htmlFor={customTopicId} className="sr-only">
            Custom debate topic or motion
          </label>
          <Textarea
            id={customTopicId}
            placeholder='Enter your debate topic or motion (e.g., "This house believes that...")'
            value={customTopic}
            onChange={(e) => onCustomTopicChange(e.target.value)}
            aria-describedby={customTopicHelpId}
            rows={3}
          />
          <p id={customTopicHelpId} className="text-xs text-stage-muted">
            For best results, phrase as a clear motion: &quot;This house believes
            that...&quot;
          </p>
        </div>
      ) : (
        <>
          {/* Pack tabs (only when packs are available) */}
          {packs.length > 0 && (
            <div className="flex gap-2 flex-wrap">
              <button
                type="button"
                onClick={() => setActivePackId("all")}
                aria-pressed={activePackId === "all"}
                className={cn(
                  "min-h-11 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                  activePackId === "all"
                    ? "bg-stage-accent text-stage-on-accent"
                    : "bg-stage-surface text-stage-muted hover:text-stage-text"
                )}
              >
                All Topics
              </button>
              {packs.map((pack) => (
                <button
                  key={pack.id}
                  type="button"
                  onClick={() => setActivePackId(pack.id)}
                  aria-pressed={activePackId === pack.id}
                  className={cn(
                    "min-h-11 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                    activePackId === pack.id
                      ? "bg-stage-accent text-stage-on-accent"
                      : "bg-stage-surface text-stage-muted hover:text-stage-text"
                  )}
                >
                  {pack.name}
                </button>
              ))}
            </div>
          )}

          {/* In a pack: show its description. In "All": show category chips. */}
          {activePack ? (
            activePack.description && (
              <p className="text-sm text-stage-muted">{activePack.description}</p>
            )
          ) : (
            <div className="flex gap-2 flex-wrap">
              {CATEGORIES.map((cat) => (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => setActiveCategory(cat.id)}
                  aria-pressed={activeCategory === cat.id}
                  className={cn(
                    "min-h-11 rounded-full px-3 py-2 text-sm font-medium transition-colors",
                    activeCategory === cat.id
                      ? "bg-stage-accent text-stage-on-accent"
                      : "bg-stage-surface text-stage-muted hover:text-stage-text"
                  )}
                >
                  {cat.label}
                </button>
              ))}
            </div>
          )}

          <fieldset className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <legend id={topicGroupLabelId} className="sr-only">
              Debate topic choices
            </legend>
            {filteredTopics.map((topic) => (
              <label key={topic.id} className="block">
                <input
                  type="radio"
                  name="debate-topic"
                  value={topic.id}
                  checked={selectedTopic?.id === topic.id}
                  onChange={() => onSelectTopic(topic)}
                  className="peer sr-only"
                />
                <span className="block cursor-pointer rounded-xl border border-stage-border bg-stage-surface p-4 transition-all duration-200 hover:border-stage-accent/50 peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-4 peer-focus-visible:outline-stage-focus peer-checked:border-stage-accent peer-checked:ring-1 peer-checked:ring-stage-accent peer-checked:shadow-lg peer-checked:shadow-stage-accent/10">
                  <span className="flex items-start justify-between gap-2">
                    <span className="text-sm font-semibold">{topic.title}</span>
                    <Badge>{topic.difficulty}</Badge>
                  </span>
                  <span className="mt-1.5 line-clamp-2 text-xs text-stage-muted">
                    {topic.motion}
                  </span>
                </span>
              </label>
            ))}
          </fieldset>
        </>
      )}
    </div>
  );
}
