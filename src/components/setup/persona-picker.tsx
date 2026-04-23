"use client";

import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PersonaId } from "@/lib/debate/types";
import { getAllPersonas } from "@/lib/debate/personas";
import { PersonaAvatar } from "@/components/debate/persona-avatar";

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
            <div className="mb-2">
              <PersonaAvatar persona={persona} size="sm" />
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
