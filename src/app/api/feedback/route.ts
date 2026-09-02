import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { checkRateLimit } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

const VALID_CATEGORIES = ["bug", "feature", "debate_quality", "general"] as const;
export type FeedbackCategory = (typeof VALID_CATEGORIES)[number];

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object") {
      return NextResponse.json(
        { error: "Invalid JSON request body." },
        { status: 400 }
      );
    }

    const { category, message, email, rating, metadata } = body;

    // 1. Validate Category
    if (!category || !VALID_CATEGORIES.includes(category)) {
      return NextResponse.json(
        {
          error: `Invalid category. Must be one of: ${VALID_CATEGORIES.join(", ")}.`,
        },
        { status: 400 }
      );
    }

    // 2. Validate Message
    const trimmedMessage = typeof message === "string" ? message.trim() : "";
    if (trimmedMessage.length < 5) {
      return NextResponse.json(
        { error: "Feedback message must be at least 5 characters long." },
        { status: 400 }
      );
    }
    if (trimmedMessage.length > 3000) {
      return NextResponse.json(
        { error: "Feedback message cannot exceed 3,000 characters." },
        { status: 400 }
      );
    }

    // 3. Validate Email (optional)
    const trimmedEmail = typeof email === "string" ? email.trim() : "";
    if (trimmedEmail && !EMAIL_REGEX.test(trimmedEmail)) {
      return NextResponse.json(
        { error: "Invalid email address format." },
        { status: 400 }
      );
    }

    // 4. Validate Rating (optional 1-5)
    let validatedRating: number | null = null;
    if (rating !== undefined && rating !== null) {
      if (typeof rating !== "number" || !Number.isInteger(rating) || rating < 1 || rating > 5) {
        return NextResponse.json(
          { error: "Rating must be an integer between 1 and 5." },
          { status: 400 }
        );
      }
      validatedRating = rating;
    }

    // 5. Auth context (optional: works for logged-in and guest users)
    let userId: string | null = null;
    let userEmail: string | null = null;
    try {
      const supabase = createServerClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        userId = user.id;
        userEmail = user.email ?? null;
      }
    } catch {
      // Continue gracefully for guest submissions
    }

    // 6. Rate Limit (IP or User ID)
    const ip =
      req.headers.get("x-forwarded-for")?.split(",")[0].trim() ??
      req.headers.get("x-real-ip") ??
      "127.0.0.1";
    const rateLimitIdentifier = userId ?? ip;
    const { success, retryAfter } = await checkRateLimit("feedback", rateLimitIdentifier);
    if (!success) {
      return NextResponse.json(
        { error: "Too many feedback submissions. Please wait a moment before trying again." },
        { status: 429, headers: { "Retry-After": String(retryAfter) } }
      );
    }

    const contactEmail = trimmedEmail || userEmail;
    const submissionId = `fb_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

    // 7. Structured Telemetry Log
    console.info("[User Feedback Received]", {
      id: submissionId,
      category,
      rating: validatedRating,
      messageLength: trimmedMessage.length,
      userId: userId ?? "anonymous",
      hasContactEmail: Boolean(contactEmail),
      platform: metadata?.platform ?? "web",
      url: metadata?.url ?? null,
      timestamp: new Date().toISOString(),
    });

    // 8. Attempt database persistence if user_feedback table exists
    try {
      const supabase = createServerClient();
      await supabase.from("user_feedback").insert({
        id: submissionId,
        user_id: userId,
        category,
        rating: validatedRating,
        message: trimmedMessage,
        contact_email: contactEmail,
        metadata: metadata ?? {},
        created_at: new Date().toISOString(),
      });
    } catch {
      // Non-fatal if table not migrated yet; telemetry is preserved
    }

    return NextResponse.json({
      success: true,
      id: submissionId,
      message: "Thank you for your feedback! Your input directly helps improve Debate Master.",
    });
  } catch (error) {
    console.error("Unhandled error processing user feedback:", error);
    return NextResponse.json(
      { error: "Internal server error while processing feedback." },
      { status: 500 }
    );
  }
}
