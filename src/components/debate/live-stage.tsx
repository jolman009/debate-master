"use client";

import Image from "next/image";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { Persona } from "@/lib/debate/types";
import { AudioBars } from "./audio-bars";

type Side = "pro" | "con";
type SpeakerStatus =
  | "speaking"
  | "thinking"
  | "your-turn"
  | "their-turn"
  | "waiting"
  | "listening";

interface LiveStageProps {
  persona: Persona;
  userSide: Side;
  isStreaming: boolean;
  isSpeaking: boolean;
  isAiTurn: boolean;
  isMyTurn: boolean;
  amplitude: number;
  // Human-vs-human mode. When set, the opponent column renders another human
  // instead of the AI persona.
  isHuman?: boolean;
  opponentJoined?: boolean;
  opponentActive?: boolean;
  opponentName?: string;
}

const STATUS_LABEL: Record<SpeakerStatus, string> = {
  speaking: "Speaking",
  thinking: "Thinking…",
  "your-turn": "Your turn",
  "their-turn": "Their turn",
  waiting: "Waiting to join…",
  listening: "Listening",
};

export function LiveStage(props: LiveStageProps) {
  if (props.isHuman) {
    return <HumanLiveStage {...props} />;
  }
  return <AiLiveStage {...props} />;
}

function AiLiveStage({
  persona,
  userSide,
  isStreaming,
  isSpeaking,
  isAiTurn,
  isMyTurn,
  amplitude,
}: LiveStageProps) {
  const aiStatus: SpeakerStatus =
    isSpeaking || isStreaming ? "speaking" : isAiTurn ? "thinking" : "listening";
  const userStatus: SpeakerStatus = isMyTurn ? "your-turn" : "listening";

  const aiActive = aiStatus === "speaking" || aiStatus === "thinking";
  const userActive = userStatus === "your-turn";

  const proColumn =
    userSide === "pro" ? (
      <UserSpeaker side="pro" active={userActive} status={userStatus} />
    ) : (
      <PersonaSpeaker
        persona={persona}
        side="pro"
        active={aiActive}
        status={aiStatus}
        amplitude={amplitude}
      />
    );

  const conColumn =
    userSide === "con" ? (
      <UserSpeaker side="con" active={userActive} status={userStatus} />
    ) : (
      <PersonaSpeaker
        persona={persona}
        side="con"
        active={aiActive}
        status={aiStatus}
        amplitude={amplitude}
      />
    );

  return (
    <div className="debate-card px-4 py-4">
      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3 sm:gap-6">
        {proColumn}
        <Divider />
        {conColumn}
      </div>
    </div>
  );
}

function HumanLiveStage({
  userSide,
  isMyTurn,
  opponentJoined,
  opponentActive,
  opponentName,
}: LiveStageProps) {
  const viewerSide: Side = userSide;
  const opponentSide: Side = viewerSide === "pro" ? "con" : "pro";

  const viewerColumn = (
    <UserSpeaker
      side={viewerSide}
      active={isMyTurn}
      status={isMyTurn ? "your-turn" : "listening"}
    />
  );

  const opponentStatus: SpeakerStatus = !opponentJoined
    ? "waiting"
    : opponentActive
    ? "their-turn"
    : "listening";

  const opponentColumn = (
    <OpponentSpeaker
      side={opponentSide}
      name={opponentName || "Opponent"}
      active={!!opponentActive}
      status={opponentStatus}
    />
  );

  const proColumn = viewerSide === "pro" ? viewerColumn : opponentColumn;
  const conColumn = viewerSide === "con" ? viewerColumn : opponentColumn;

  return (
    <div className="debate-card px-4 py-4">
      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3 sm:gap-6">
        {proColumn}
        <Divider />
        {conColumn}
      </div>
    </div>
  );
}

interface OpponentSpeakerProps {
  side: Side;
  name: string;
  active: boolean;
  status: SpeakerStatus;
}

function OpponentSpeaker({ side, name, active, status }: OpponentSpeakerProps) {
  const colorVar = side === "pro" ? "var(--stage-pro)" : "var(--stage-con)";
  return (
    <SpeakerColumn align={side === "pro" ? "left" : "right"}>
      <UserAvatarLarge active={active} colorVar={colorVar} />
      <SpeakerInfo
        align={side === "pro" ? "left" : "right"}
        name={name}
        side={side}
        status={status}
        active={active}
        amplitude={0}
        speaking={false}
        barColor={`rgb(${colorVar})`}
      />
    </SpeakerColumn>
  );
}

function Divider() {
  return (
    <div className="flex flex-col items-center gap-1 self-stretch">
      <div className="flex-1 w-px bg-stage-border" />
      <span className="text-[10px] font-bold tracking-widest text-stage-muted">
        VS
      </span>
      <div className="flex-1 w-px bg-stage-border" />
    </div>
  );
}

interface PersonaSpeakerProps {
  persona: Persona;
  side: Side;
  active: boolean;
  status: SpeakerStatus;
  amplitude: number;
}

function PersonaSpeaker({
  persona,
  side,
  active,
  status,
  amplitude,
}: PersonaSpeakerProps) {
  const speaking = status === "speaking";
  return (
    <SpeakerColumn align={side === "pro" ? "left" : "right"}>
      <PersonaAvatarLarge
        persona={persona}
        speaking={speaking}
        thinking={status === "thinking"}
        amplitude={amplitude}
        active={active}
      />
      <SpeakerInfo
        align={side === "pro" ? "left" : "right"}
        name={persona.displayName}
        side={side}
        status={status}
        active={active}
        amplitude={amplitude}
        speaking={speaking}
        barColor={persona.theme.from}
      />
    </SpeakerColumn>
  );
}

interface UserSpeakerProps {
  side: Side;
  active: boolean;
  status: SpeakerStatus;
}

function UserSpeaker({ side, active, status }: UserSpeakerProps) {
  const colorVar = side === "pro" ? "var(--stage-pro)" : "var(--stage-con)";
  return (
    <SpeakerColumn align={side === "pro" ? "left" : "right"}>
      <UserAvatarLarge active={active} colorVar={colorVar} />
      <SpeakerInfo
        align={side === "pro" ? "left" : "right"}
        name="You"
        side={side}
        status={status}
        active={active}
        amplitude={0}
        speaking={false}
        barColor={`rgb(${colorVar})`}
      />
    </SpeakerColumn>
  );
}

function SpeakerColumn({
  children,
  align,
}: {
  children: React.ReactNode;
  align: "left" | "right";
}) {
  return (
    <div
      className={cn(
        "flex items-center gap-3 min-w-0",
        align === "right" && "flex-row-reverse"
      )}
    >
      {children}
    </div>
  );
}

interface SpeakerInfoProps {
  name: string;
  side: Side;
  status: SpeakerStatus;
  active: boolean;
  amplitude: number;
  speaking: boolean;
  barColor: string;
  align: "left" | "right";
}

function SpeakerInfo({
  name,
  side,
  status,
  active,
  amplitude,
  speaking,
  barColor,
  align,
}: SpeakerInfoProps) {
  const sideLabel = side === "pro" ? "PRO" : "CON";
  const sideColorClass = side === "pro" ? "text-stage-pro" : "text-stage-con";
  return (
    <div
      className={cn(
        "flex flex-col gap-1 min-w-0",
        align === "right" && "items-end text-right"
      )}
    >
      <p
        className={cn(
          "text-sm font-semibold leading-tight truncate transition-opacity",
          !active && "opacity-60"
        )}
      >
        {name}
      </p>
      <p className={cn("text-[11px] font-bold tracking-wider", sideColorClass)}>
        {sideLabel}
      </p>
      <StatusPill status={status} />
      <div className={cn(align === "right" && "self-end")}>
        <AudioBars amplitude={amplitude} active={speaking} color={barColor} />
      </div>
    </div>
  );
}

function StatusPill({ status }: { status: SpeakerStatus }) {
  const speaking = status === "speaking";
  const yourTurn = status === "your-turn";
  const accented = speaking || yourTurn || status === "their-turn";
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 text-[10px] uppercase tracking-wider w-fit",
        accented ? "text-stage-accent" : "text-stage-muted"
      )}
    >
      {accented && (
        <span className="inline-block w-1.5 h-1.5 rounded-full bg-stage-accent animate-pulse" />
      )}
      {STATUS_LABEL[status]}
    </span>
  );
}

interface PersonaAvatarLargeProps {
  persona: Persona;
  speaking: boolean;
  thinking: boolean;
  amplitude: number;
  active: boolean;
}

function PersonaAvatarLarge({
  persona,
  speaking,
  thinking,
  amplitude,
  active,
}: PersonaAvatarLargeProps) {
  const { theme } = persona;
  const gradient = `linear-gradient(135deg, ${theme.from}, ${theme.to})`;

  const activeUrl = speaking
    ? persona.avatarUrlSpeaking || persona.avatarUrl
    : thinking
    ? persona.avatarUrlThinking || persona.avatarUrl
    : persona.avatarUrl;

  const [failedUrls, setFailedUrls] = useState<Set<string>>(new Set());
  const showImage = !!activeUrl && !failedUrls.has(activeUrl);

  const baseScale = speaking ? 1.05 : active ? 1.02 : 1;
  // Procedural "talking" motion: on loud syllables the head stretches
  // taller and narrows slightly (a jaw-drop illusion) with a small lift,
  // so a flat portrait reads as actively speaking.
  const scaleX = baseScale - (speaking ? amplitude * 0.03 : 0);
  const scaleY = baseScale + (speaking ? amplitude * 0.07 : 0);
  const bobY = speaking ? -amplitude * 3.5 : 0;
  const glowAlpha = speaking ? 0.55 + amplitude * 0.45 : active ? 0.35 : 0;
  const ringPx = speaking ? 18 + amplitude * 18 : active ? 10 : 0;
  const glowRgb = hexToRgb(theme.from);

  return (
    <div className="relative flex items-center justify-center shrink-0">
      {speaking && (
        <span
          aria-hidden
          className="absolute inset-0 rounded-full animate-ping opacity-60 pointer-events-none"
          style={{ boxShadow: `0 0 0 3px ${theme.from}` }}
        />
      )}
      <div
        className={cn(
          "relative w-20 h-20 sm:w-24 sm:h-24 rounded-full overflow-hidden font-bold text-white text-2xl flex items-center justify-center transition-[transform,filter] duration-100 ease-out",
          !active && "grayscale-[40%]"
        )}
        style={{
          background: gradient,
          transform: `translateY(${bobY}px) scale(${scaleX}, ${scaleY})`,
          opacity: active ? 1 : 0.55,
          boxShadow: `0 0 ${ringPx}px ${
            ringPx / 3
          }px rgba(${glowRgb}, ${glowAlpha}), inset 0 0 0 2px ${theme.from}`,
        }}
      >
        {showImage ? (
          <Image
            key={activeUrl}
            src={activeUrl}
            alt={persona.displayName}
            fill
            sizes="96px"
            className="object-cover"
            onError={() =>
              setFailedUrls((prev) => {
                const next = new Set(prev);
                next.add(activeUrl);
                return next;
              })
            }
          />
        ) : (
          <span className="drop-shadow-[0_1px_2px_rgba(0,0,0,0.35)]">
            {persona.displayName[0]}
          </span>
        )}
      </div>
    </div>
  );
}

function UserAvatarLarge({
  active,
  colorVar,
}: {
  active: boolean;
  colorVar: string;
}) {
  return (
    <div className="relative flex items-center justify-center shrink-0">
      <div
        className={cn(
          "relative w-20 h-20 sm:w-24 sm:h-24 rounded-full overflow-hidden text-white flex items-center justify-center transition-all duration-200",
          !active && "grayscale-[60%]"
        )}
        style={{
          background: `linear-gradient(135deg, rgb(${colorVar}), rgb(var(--stage-accent)))`,
          opacity: active ? 1 : 0.55,
          boxShadow: active
            ? `0 0 18px 4px rgb(${colorVar} / 0.45), inset 0 0 0 2px rgb(${colorVar})`
            : "inset 0 0 0 2px rgba(255,255,255,0.15)",
        }}
      >
        <UserGlyph />
      </div>
    </div>
  );
}

function UserGlyph() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      className="w-10 h-10 opacity-90"
      aria-hidden
    >
      <circle cx="12" cy="8" r="4" />
      <path d="M4 20c0-4 4-7 8-7s8 3 8 7v1H4v-1z" />
    </svg>
  );
}

function hexToRgb(hex: string): string {
  if (hex.startsWith("rgb")) {
    const m = hex.match(/\d+/g);
    if (m && m.length >= 3) return `${m[0]}, ${m[1]}, ${m[2]}`;
  }
  let h = hex.replace("#", "");
  if (h.length === 3)
    h = h
      .split("")
      .map((c) => c + c)
      .join("");
  const r = parseInt(h.substring(0, 2), 16) || 0;
  const g = parseInt(h.substring(2, 4), 16) || 0;
  const b = parseInt(h.substring(4, 6), 16) || 0;
  return `${r}, ${g}, ${b}`;
}
