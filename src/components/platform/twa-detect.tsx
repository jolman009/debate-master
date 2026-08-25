"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { TWA_COOKIE, isTwaReferrer } from "@/lib/platform/twa";

/**
 * Backstop for TWA detection.
 *
 * Middleware normally latches the `dm_twa` cookie from the launch navigation's
 * `Referer` header. If that header is ever missing (proxy stripped it, an
 * unusual Chrome build, a restored tab), `document.referrer` still reports the
 * android-app:// origin — so we set the cookie here and refresh once so the
 * server re-renders with the upgrade paths hidden.
 *
 * Renders nothing, and does nothing at all on the open web.
 */
export function TwaDetect() {
  const router = useRouter();

  useEffect(() => {
    if (!isTwaReferrer(document.referrer)) return;
    if (document.cookie.includes(`${TWA_COOKIE}=1`)) return;

    document.cookie = `${TWA_COOKIE}=1; path=/; max-age=31536000; samesite=lax`;
    // Re-render server components with the cookie now present.
    router.refresh();
  }, [router]);

  return null;
}
