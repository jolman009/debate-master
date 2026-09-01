import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const { usefulness, feedbackVersion, overallScore } = body;

    const validRatings = ["helpful", "not_helpful", "reported"];
    if (!usefulness || !validRatings.includes(usefulness)) {
      return NextResponse.json(
        { error: "Invalid usefulness rating" },
        { status: 400 }
      );
    }

    // Telemetry log for analytics (privacy-safe: no raw debate transcript stored)
    console.info("[Feedback Telemetry]", {
      usefulness,
      feedbackVersion: feedbackVersion ?? 1,
      overallScore: typeof overallScore === "number" ? overallScore : null,
      timestamp: new Date().toISOString(),
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to record feedback usefulness signal:", error);
    return NextResponse.json(
      { error: "Failed to record feedback signal" },
      { status: 500 }
    );
  }
}
