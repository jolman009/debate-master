// SERVER ONLY: reads the TWA marker cookie set by middleware.
//
// Detection happens once in middleware (from the launch navigation's Referer)
// and is remembered in a cookie, so server components can render the correct
// UI on the FIRST paint — no flash of an upgrade button inside the Play app.

import { cookies } from "next/headers";
import { TWA_COOKIE } from "./twa";

/** True when this request is being rendered inside the Android TWA shell. */
export function isTwa(): boolean {
  try {
    return cookies().get(TWA_COOKIE)?.value === "1";
  } catch {
    // Called outside a request scope (e.g. static generation).
    return false;
  }
}
