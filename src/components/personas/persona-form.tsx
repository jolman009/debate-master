"use client";

import { useId, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { PersonaAvatar } from "@/components/debate/persona-avatar";
import { VoicePreviewButton } from "@/components/setup/voice-preview-button";
import { Persona } from "@/lib/debate/types";
import {
  VOICE_PRESETS,
  THEME_PRESETS,
  LIMITS,
} from "@/lib/debate/custom-persona";
import { cn } from "@/lib/utils";

const inputClass =
  "min-h-11 w-full rounded-lg border border-stage-border bg-stage-bg px-3 py-2 text-sm text-stage-text outline-none focus:border-stage-accent";

export function PersonaForm() {
  const router = useRouter();
  const idPrefix = useId();
  const [displayName, setDisplayName] = useState("");
  const [tagline, setTagline] = useState("");
  const [ideology, setIdeology] = useState("");
  const [worldview, setWorldview] = useState("");
  const [voiceId, setVoiceId] = useState(VOICE_PRESETS[0].id);
  const [pitch, setPitch] = useState(1);
  const [rate, setRate] = useState(1);
  const [themeIndex, setThemeIndex] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const theme = THEME_PRESETS[themeIndex];
  const nameId = `${idPrefix}-name`;
  const taglineId = `${idPrefix}-tagline`;
  const ideologyId = `${idPrefix}-ideology`;
  const worldviewId = `${idPrefix}-worldview`;
  const worldviewHelpId = `${idPrefix}-worldview-help`;
  const voiceIdInputId = `${idPrefix}-voice`;
  const pitchId = `${idPrefix}-pitch`;
  const rateId = `${idPrefix}-rate`;

  const previewPersona: Persona = {
    id: "preview",
    displayName: displayName || "New Persona",
    tagline: tagline || "Your custom opponent",
    ideology,
    systemPrompt: "",
    avatarUrl: "",
    voiceConfig: { pitch, rate, voicePrefs: [], elevenLabsVoiceId: voiceId || undefined },
    theme,
  };

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/personas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          displayName,
          tagline,
          ideology,
          worldview,
          voiceId: voiceId || undefined,
          pitch,
          rate,
          theme,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Could not create persona");
      }
      router.push("/personas");
      router.refresh();
    } catch (err) {
      setError((err as Error).message);
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Live preview */}
      <div className="debate-card flex items-center gap-4 p-4">
        <div className="relative">
          <PersonaAvatar persona={previewPersona} size="lg" showName />
          <VoicePreviewButton persona={previewPersona} />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor={nameId} className="mb-1 block text-sm font-medium">Name</label>
          <input
            id={nameId}
            className={inputClass}
            value={displayName}
            maxLength={LIMITS.displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            placeholder="e.g. The Pragmatist"
          />
        </div>
        <div>
          <label htmlFor={taglineId} className="mb-1 block text-sm font-medium">Tagline</label>
          <input
            id={taglineId}
            className={inputClass}
            value={tagline}
            maxLength={LIMITS.tagline}
            onChange={(e) => setTagline(e.target.value)}
            placeholder="Short one-liner"
          />
        </div>
      </div>

      <div>
        <label htmlFor={ideologyId} className="mb-1 block text-sm font-medium">
          Ideology / leaning <span className="text-stage-muted">(optional)</span>
        </label>
        <input
          id={ideologyId}
          className={inputClass}
          value={ideology}
          maxLength={LIMITS.ideology}
          onChange={(e) => setIdeology(e.target.value)}
          placeholder="e.g. Techno-optimist"
        />
      </div>

      <div>
        <label htmlFor={worldviewId} className="mb-1 block text-sm font-medium">
          Style &amp; worldview
        </label>
        <Textarea
          id={worldviewId}
          value={worldview}
          rows={6}
          maxLength={LIMITS.worldviewMax}
          onChange={(e) => setWorldview(e.target.value)}
          placeholder="Describe how this character argues, what they believe, their rhetorical style and priorities. This shapes their debate behavior."
          aria-describedby={worldviewHelpId}
        />
        <p id={worldviewHelpId} className="mt-1 text-xs text-stage-muted">
          {worldview.trim().length}/{LIMITS.worldviewMax} · min{" "}
          {LIMITS.worldviewMin}. A fictional-character framing and safety rules
          are always applied on top of this.
        </p>
      </div>

      {/* Theme */}
      <div>
        <fieldset>
          <legend className="mb-2 block text-sm font-medium">Theme</legend>
        <div className="flex flex-wrap gap-3">
          {THEME_PRESETS.map((t, i) => (
            <button
              key={t.from}
              type="button"
              aria-label={`Theme ${i + 1}`}
              aria-pressed={themeIndex === i}
              onClick={() => setThemeIndex(i)}
              className={cn(
                "min-h-11 min-w-11 rounded-full ring-offset-2 ring-offset-stage-bg transition",
                themeIndex === i && "ring-2 ring-stage-accent"
              )}
              style={{
                background: `linear-gradient(135deg, ${t.from}, ${t.to})`,
              }}
            />
          ))}
        </div>
        </fieldset>
      </div>

      {/* Voice */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="sm:col-span-3">
          <label htmlFor={voiceIdInputId} className="mb-1 block text-sm font-medium">Synthetic voice</label>
          <select
            id={voiceIdInputId}
            className={inputClass}
            value={voiceId}
            onChange={(e) => setVoiceId(e.target.value)}
          >
            <option value="">Browser voice (no ElevenLabs)</option>
            {VOICE_PRESETS.map((v) => (
              <option key={v.id} value={v.id}>
                {v.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor={pitchId} className="mb-1 block text-sm font-medium">
            Pitch: {pitch.toFixed(2)}
          </label>
          <input
            id={pitchId}
            type="range"
            min={0.5}
            max={2}
            step={0.05}
            value={pitch}
            onChange={(e) => setPitch(Number(e.target.value))}
            className="w-full"
          />
        </div>
        <div>
          <label htmlFor={rateId} className="mb-1 block text-sm font-medium">
            Rate: {rate.toFixed(2)}
          </label>
          <input
            id={rateId}
            type="range"
            min={0.5}
            max={2}
            step={0.05}
            value={rate}
            onChange={(e) => setRate(Number(e.target.value))}
            className="w-full"
          />
        </div>
      </div>

      {error && <p role="alert" className="text-sm text-stage-con">{error}</p>}

      <div className="flex justify-end gap-3">
        <Button
          type="button"
          variant="ghost"
          onClick={() => router.push("/personas")}
        >
          Cancel
        </Button>
        <Button type="submit" disabled={submitting}>
          {submitting ? "Creating..." : "Create persona"}
        </Button>
      </div>
    </form>
  );
}
