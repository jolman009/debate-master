export interface NavItem {
  href: string;
  label: string;
  match: "exact" | "prefix";
  signedInOnly?: boolean;
  hideInTwa?: boolean;
}

export const PRODUCT_NAV_ITEMS: NavItem[] = [
  {
    href: "/debate",
    label: "Practice",
    match: "exact",
    signedInOnly: true,
  },
  {
    href: "/debate/new",
    label: "New Debate",
    match: "exact",
    signedInOnly: true,
  },
  {
    href: "/personas",
    label: "Library",
    match: "prefix",
    signedInOnly: true,
  },
  {
    href: "/leaderboard",
    label: "Leaderboard",
    match: "prefix",
  },
  {
    href: "/pricing",
    label: "Pricing",
    match: "prefix",
    hideInTwa: true,
  },
];

export const BOTTOM_NAV_HREFS = [
  "/debate",
  "/debate/new",
  "/personas",
  "/leaderboard",
] as const;

export function navItemVisible(
  item: NavItem,
  signedIn: boolean,
  inTwa: boolean
) {
  if (item.signedInOnly && !signedIn) return false;
  if (item.hideInTwa && inTwa) return false;
  return true;
}

export function navItemActive(pathname: string, item: NavItem) {
  if (item.match === "exact") return pathname === item.href;
  return pathname === item.href || pathname.startsWith(`${item.href}/`);
}

export function getVisibleNavItems(signedIn: boolean, inTwa: boolean) {
  return PRODUCT_NAV_ITEMS.filter((item) =>
    navItemVisible(item, signedIn, inTwa)
  );
}

export function getDesktopNavItems(signedIn: boolean, inTwa: boolean) {
  return getVisibleNavItems(signedIn, inTwa).filter((item) =>
    signedIn ? item.href !== "/pricing" : true
  );
}

export function getBottomNavItems(signedIn: boolean, inTwa: boolean) {
  if (!signedIn) return [];
  return getVisibleNavItems(signedIn, inTwa).filter((item) =>
    BOTTOM_NAV_HREFS.includes(item.href as (typeof BOTTOM_NAV_HREFS)[number])
  );
}

export function getProfileMenuNavItems(signedIn: boolean, inTwa: boolean) {
  if (!signedIn) return [];
  return getVisibleNavItems(signedIn, inTwa);
}
