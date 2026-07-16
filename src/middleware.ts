import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { TWA_COOKIE, isTwaReferrer } from "@/lib/platform/twa";

const YEAR_SECONDS = 60 * 60 * 24 * 365;

/** Persists the TWA marker on the browser for subsequent navigations. */
function persistTwaCookie(
  response: NextResponse,
  shouldMark: boolean
): NextResponse {
  if (shouldMark) {
    response.cookies.set(TWA_COOKIE, "1", {
      path: "/",
      maxAge: YEAR_SECONDS,
      sameSite: "lax",
    });
  }
  return response;
}

/**
 * Refreshes the Supabase auth session on every request and gates the
 * `/debate/*` routes behind authentication.
 */
export async function middleware(request: NextRequest) {
  // Only the LAUNCH navigation carries the `android-app://` referrer, so latch
  // it into a cookie the moment we see it (Play policy — see lib/platform/twa).
  //
  // This MUST happen before NextResponse.next({ request }): that call forwards
  // the request's cookies to the render, so setting it on the request is what
  // lets server components hide the upgrade paths on this very first paint.
  // Setting it only on the response would leave the app's opening screen
  // showing a Stripe upgrade link — exactly what Play forbids.
  const shouldMarkTwa =
    request.cookies.get(TWA_COOKIE)?.value !== "1" &&
    isTwaReferrer(request.headers.get("referer"));
  if (shouldMarkTwa) {
    request.cookies.set(TWA_COOKIE, "1");
  }

  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // getUser() revalidates the token with the Supabase auth server.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const path = request.nextUrl.pathname;
  const isProtected = path.startsWith("/debate");

  if (!user && isProtected) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("redirect", path);
    return persistTwaCookie(NextResponse.redirect(url), shouldMarkTwa);
  }

  // A signed-in user has no reason to see the login form — send them to
  // their dashboard, honoring an explicit internal `?redirect=` if present.
  if (user && path === "/login") {
    const target = request.nextUrl.searchParams.get("redirect");
    const url = request.nextUrl.clone();
    url.pathname =
      target && target.startsWith("/") && !target.startsWith("//")
        ? target
        : "/debate";
    url.search = "";
    return persistTwaCookie(NextResponse.redirect(url), shouldMarkTwa);
  }

  return persistTwaCookie(response, shouldMarkTwa);
}

export const config = {
  matcher: [
    /*
     * Run on all paths except Next internals, static assets, and
     * /.well-known/* (Android asset-link verification must stay fast and
     * must never depend on an auth round-trip).
     */
    "/((?!_next/static|_next/image|favicon.ico|\\.well-known|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
