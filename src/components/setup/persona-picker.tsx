"use client";

import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Persona, PersonaId } from "@/lib/debate/types";
import { PersonaAvatar } from "@/components/debate/persona-avatar";
import { VoicePreviewButton } from "./voice-preview-button";

interface PersonaPickerProps {
  personas: Persona[];
  selectedPersona: PersonaId | null;
  onSelectPersona: (id: PersonaId) => void;
}

export function PersonaPicker({
  personas,
  selectedPersona,
  onSelectPersona,
}: PersonaPickerProps) {
  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-xl font-bold">Choose Your Opponent</h2>
        <p className="mt-1 text-sm text-stage-muted">
          These opponents are AI simulations, not the real public figures.
        </p>
      </div>
      <fieldset className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <legend className="sr-only">AI persona choices</legend>
        {personas.map((persona) => (
          <div key={persona.id} className="relative">
            <VoicePreviewButton persona={persona} />
            <label className="block">
              <input
                type="radio"
                name="opponent-persona"
                value={persona.id}
                checked={selectedPersona === persona.id}
                onChange={() => onSelectPersona(persona.id)}
                className="peer sr-only"
              />
              <span className="block min-h-full cursor-pointer rounded-xl border border-stage-border bg-stage-surface p-4 transition-all duration-200 hover:border-stage-accent/50 peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-4 peer-focus-visible:outline-stage-focus peer-checked:border-stage-accent peer-checked:ring-1 peer-checked:ring-stage-accent peer-checked:shadow-lg peer-checked:shadow-stage-accent/10">
                <span className="mb-2 block">
                  <PersonaAvatar persona={persona} size="sm" />
                </span>
                <span className="mb-2 block text-xs text-stage-muted">
                  AI simulation. Not affiliated with {persona.displayName}.
                </span>
                <Badge variant="accent" className="text-xs">
                  {persona.ideology}
                </Badge>
              </span>
            </label>
          </div>
        ))}

        <Link
          href="/personas/new"
          className="flex min-h-[132px] flex-col items-center justify-center gap-1.5 rounded-xl border border-dashed border-stage-border p-4 text-stage-muted transition-colors hover:border-stage-accent hover:text-stage-accent"
        >
          <span className="text-2xl leading-none">+</span>
          <span className="text-sm font-medium">Create persona</span>
        </Link>
      </fieldset>
    </div>
  );
}
