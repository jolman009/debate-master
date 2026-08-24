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
