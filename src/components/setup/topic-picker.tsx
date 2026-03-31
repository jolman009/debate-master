"use client";

import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Topic } from "@/lib/debate/types";
import { CURATED_TOPICS } from "@/lib/debate/topics";
import { cn } from "@/lib/utils";

interface TopicPickerProps {
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
  selectedTopic,
  customTopic,
  onSelectTopic,
  onCustomTopicChange,
}: TopicPickerProps) {
  const [activeCategory, setActiveCategory] = useState("all");
  const [useCustom, setUseCustom] = useState(false);

  const filteredTopics =
    activeCategory === "all"
      ? CURATED_TOPICS
      : CURATED_TOPICS.filter((t) => t.category === activeCategory);

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
          <div className="flex gap-2 flex-wrap">
            {CATEGORIES.map((cat) => (
              <button
                key={cat.id}
                onClick={() => setActiveCategory(cat.id)}
                className={cn(
                  "text-sm px-3 py-1 rounded-full transition-colors",
                  activeCategory === cat.id
                    ? "bg-stage-accent text-white"
                    : "bg-stage-surface text-stage-muted hover:text-white"
                )}
              >
                {cat.label}
              </button>
            ))}
          </div>

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
