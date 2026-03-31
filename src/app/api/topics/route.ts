import { NextResponse } from "next/server";
import { CURATED_TOPICS } from "@/lib/debate/topics";

export async function GET() {
  return NextResponse.json({ topics: CURATED_TOPICS });
}
