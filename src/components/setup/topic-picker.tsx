"use client";

import { useState } from "react";
import { Card } from "@/components/ui/card";
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
          onClick={() => {
            setUseCustom(!useCustom);
            if (!useCustom) onSelectTopic(null);
          }}
          className="text-sm text-stage-accent hover:text-stage-accent-hover transition-colors"
        >
          {useCustom ? "Pick from list" : "Custom topic"}
        </button>
      </div>

      {useCustom ? (
        <div className="space-y-2">
          <Textarea
            placeholder='Enter your debate topic or motion (e.g., "This house believes that...")'
            value={customTopic}
            onChange={(e) => onCustomTopicChange(e.target.value)}
            rows={3}
          />
          <p className="text-xs text-stage-muted">
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
                onClick={() => setActivePackId("all")}
                className={cn(
                  "text-sm px-3 py-1.5 rounded-lg font-medium transition-colors",
                  activePackId === "all"
                    ? "bg-stage-accent text-white"
                    : "bg-stage-surface text-stage-muted hover:text-stage-text"
                )}
              >
                All Topics
              </button>
              {packs.map((pack) => (
                <button
                  key={pack.id}
                  onClick={() => setActivePackId(pack.id)}
                  className={cn(
                    "text-sm px-3 py-1.5 rounded-lg font-medium transition-colors",
                    activePackId === pack.id
                      ? "bg-stage-accent text-white"
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
                  onClick={() => setActiveCategory(cat.id)}
                  className={cn(
                    "text-sm px-3 py-1 rounded-full transition-colors",
                    activeCategory === cat.id
                      ? "bg-stage-accent text-white"
                      : "bg-stage-surface text-stage-muted hover:text-stage-text"
                  )}
                >
                  {cat.label}
                </button>
              ))}
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {filteredTopics.map((topic) => (
              <Card
                key={topic.id}
                selected={selectedTopic?.id === topic.id}
                className="cursor-pointer p-4"
                onClick={() => onSelectTopic(topic)}
              >
                <div className="flex items-start justify-between gap-2">
                  <h3 className="font-semibold text-sm">{topic.title}</h3>
                  <Badge>{topic.difficulty}</Badge>
                </div>
                <p className="text-xs text-stage-muted mt-1.5 line-clamp-2">
                  {topic.motion}
                </p>
              </Card>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
