"use client";

import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PersonaId } from "@/lib/debate/types";
import { getAllPersonas } from "@/lib/debate/personas";

interface PersonaPickerProps {
  selectedPersona: PersonaId | null;
  onSelectPersona: (id: PersonaId) => void;
}

export function PersonaPicker({
  selectedPersona,
  onSelectPersona,
}: PersonaPickerProps) {
  const personas = getAllPersonas();

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-bold">Choose Your Opponent</h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {personas.map((persona) => (
          <Card
            key={persona.id}
            selected={selectedPersona === persona.id}
            className="cursor-pointer p-4"
            onClick={() => onSelectPersona(persona.id)}
          >
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 rounded-full bg-stage-accent/20 flex items-center justify-center text-stage-accent font-bold text-lg">
                {persona.displayName[0]}
              </div>
              <div>
                <h3 className="font-semibold text-sm">
                  {persona.displayName}
                </h3>
                <p className="text-xs text-stage-muted">{persona.tagline}</p>
              </div>
            </div>
            <Badge variant="accent" className="text-xs">
              {persona.ideology}
            </Badge>
          </Card>
        ))}
      </div>
    </div>
  );
}
