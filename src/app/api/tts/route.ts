import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const ELEVENLABS_BASE = "https://api.elevenlabs.io/v1/text-to-speech";
const DEFAULT_MODEL = "eleven_flash_v2_5";
const OUTPUT_FORMAT = "mp3_44100_128";

export async function POST(request: Request) {
  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "ELEVENLABS_API_KEY not configured" },
      { status: 503 }
    );
  }

  let body: { text?: string; voiceId?: string; modelId?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const text = body.text?.trim();
  const voiceId = body.voiceId?.trim();
  const modelId = body.modelId?.trim() || DEFAULT_MODEL;

  if (!text) {
    return NextResponse.json({ error: "text is required" }, { status: 400 });
  }
  if (!voiceId) {
    return NextResponse.json({ error: "voiceId is required" }, { status: 400 });
  }
  if (text.length > 2500) {
    return NextResponse.json(
      { error: "text exceeds 2500 char limit per request" },
      { status: 400 }
    );
  }

  const url = `${ELEVENLABS_BASE}/${voiceId}/stream?output_format=${OUTPUT_FORMAT}`;

  const upstream = await fetch(url, {
    method: "POST",
    headers: {
      "xi-api-key": apiKey,
      "Content-Type": "application/json",
      Accept: "audio/mpeg",
    },
    body: JSON.stringify({
      text,
      model_id: modelId,
      voice_settings: {
        stability: 0.5,
        similarity_boost: 0.75,
        style: 0.2,
        use_speaker_boost: true,
      },
    }),
  });

  if (!upstream.ok || !upstream.body) {
    const errText = await upstream.text().catch(() => "");
    return NextResponse.json(
      { error: `ElevenLabs error ${upstream.status}: ${errText.slice(0, 200)}` },
      { status: upstream.status === 401 ? 503 : 502 }
    );
  }

  return new Response(upstream.body, {
    headers: {
      "Content-Type": "audio/mpeg",
      "Cache-Control": "no-store",
    },
  });
}
