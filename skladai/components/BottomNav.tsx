"use client";

import { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Scan, Dumbbell, BarChart3, User } from "lucide-react";
import { useUserMode } from "@/lib/hooks/useUserMode";
import { getNavConfigForMode, type NavRoute } from "@/lib/modes";

// Master TAB definitions — keep ALL 4 zawsze. Per-mode reorder via
// MODE_NAV_CONFIG. NIE usuwać tabów z tej tablicy, BottomNav może
// fallbackować do oryginalnej kolejności jeśli mode byłby błędny.
const TABS = [
  { href: "/", icon: Scan, label: "Skanuj" },
  { href: "/forma", icon: Dumbbell, label: "Forma" },
  { href: "/dashboard", icon: BarChart3, label: "Dashboard" },
  { href: "/profil", icon: User, label: "Profil" },
] as const;

// Quick lookup po href dla reorder logic
const TAB_BY_HREF = new Map<string, (typeof TABS)[number]>(
  TABS.map((t) => [t.href, t])
);

/**
 * Theme color resolution priority (Etap 2 Krok B):
 *   1. Per-route override (/forma=orange, /biegacz=orange, /promile=indigo)
 *      → te specjalistyczne strony mają własną tożsamość, NIE nadpisujemy
 *        ich kolorem trybu (decyzja Q3 = C)
 *   2. Mode-aware accent (fitness=mint, health=cyan, cosmetics=purple)
 *      → wszystkie inne strony (Skaner home, Dashboard, Profil, premium itd.)
 *   3. Brand mint fallback (gdy `mode` jeszcze nie loaded)
 */
function getThemeColors(pathname: string, modeAccent: string | null) {
  if (pathname === "/forma" || pathname === "/biegacz") {
    return { active: "#f97316", inactive: "rgba(255,255,255,0.25)" };
  }
  if (pathname === "/promile") {
    return { active: "#818CF8", inactive: "rgba(255,255,255,0.2)" };
  }
  return { active: modeAccent ?? "#6efcb4", inactive: "rgba(255,255,255,0.25)" };
}

// Public / static pages where the in-app BottomNav would look out of
// place (legal docs, support, deep-link targets). Kept in sync with
// PUBLIC_ROUTES in OnboardingWrapper.
const HIDDEN_PREFIXES = [
  "/wyniki",
  "/admin",
  "/privacy",
  "/polityka-prywatnosci",
  "/support",
  "/kontakt",
  "/terms",
  "/regulamin",
  "/delete-account",
];

export default function BottomNav() {
  const pathname = usePathname();
  const hidden = HIDDEN_PREFIXES.some((p) => pathname === p || pathname.startsWith(p + "/"));

  // Etap 2 Krok B: mode-aware reorder. Reorder bezpieczny — jeśli
  // któryś tab z config nie istnieje w master TABS, filter usuwa go.
  const { mode } = useUserMode();
  const navConfig = useMemo(() => getNavConfigForMode(mode), [mode]);
  const orderedTabs = useMemo(() => {
    const ordered = navConfig.tabs
      .map((href) => TAB_BY_HREF.get(href))
      .filter((t): t is (typeof TABS)[number] => t !== undefined);
    // Defensive: jeśli reorder coś popsuł (np. mode dodał nieistniejący tab),
    // fallback do master TABS żeby user nie został z pustym nav
    return ordered.length === TABS.length ? ordered : TABS;
  }, [navConfig]);

  // Track onboarding-active class on body to hide nav during onboarding
  const [onboarding, setOnboarding] = useState(false);
  useEffect(() => {
    const obs = new MutationObserver(() => {
      setOnboarding(document.body.classList.contains("onboarding-active"));
    });
    obs.observe(document.body, { attributes: true, attributeFilter: ["class"] });
    // Initial check
    setOnboarding(document.body.classList.contains("onboarding-active"));
    return () => obs.disconnect();
  }, []);

  // Toggle body class so CSS knows whether to shrink scroll-container
  useEffect(() => {
    if (hidden) {
      document.body.classList.add("no-bottom-nav");
    } else {
      document.body.classList.remove("no-bottom-nav");
    }
  }, [hidden]);

  if (hidden || onboarding) return null;

  const theme = getThemeColors(pathname, navConfig.navAccentColor);

  return (
    <nav
      style={{
        position: "fixed",
        bottom: 0,
        left: 0,
        right: 0,
        zIndex: 9999,
        height: 68,
        paddingBottom: "env(safe-area-inset-bottom, 0px)",
        background: "rgba(10,14,12,0.95)",
        backdropFilter: "blur(20px)",
        WebkitBackdropFilter: "blur(20px)",
        borderTop: "1px solid rgba(255,255,255,0.05)",
        transform: "translateZ(0)",
        WebkitTransform: "translateZ(0)",
        backfaceVisibility: "hidden",
        WebkitBackfaceVisibility: "hidden",
        willChange: "transform",
      }}
    >
      <div style={{
        maxWidth: 448, margin: "0 auto",
        display: "flex", justifyContent: "space-around", alignItems: "center",
        height: "100%", padding: "0 8px",
      }}>
        {orderedTabs.map((tab) => {
          const isActive = tab.href === "/" ? pathname === "/" : pathname.startsWith(tab.href);
          const Icon = tab.icon;
          const color = isActive ? theme.active : theme.inactive;

          return (
            <Link
              key={tab.href}
              href={tab.href}
              style={{
                display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
                minWidth: 64, minHeight: 48, padding: "4px 12px",
                position: "relative", textDecoration: "none",
              }}
            >
              {isActive && (
                <span style={{
                  position: "absolute", top: -1, width: 20, height: 3,
                  borderRadius: 2, backgroundColor: theme.active,
                }} />
              )}
              <Icon size={26} strokeWidth={1.8} style={{ color }} />
              <span style={{
                fontSize: 11, marginTop: 4, lineHeight: 1, color,
                fontWeight: isActive ? 700 : 500,
              }}>
                {tab.label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
