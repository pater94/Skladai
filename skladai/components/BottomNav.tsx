"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Scan, Dumbbell, BarChart3, User } from "lucide-react";

const TABS = [
  { href: "/", icon: Scan, label: "Skanuj" },
  { href: "/forma", icon: Dumbbell, label: "Forma" },
  { href: "/dashboard", icon: BarChart3, label: "Dashboard" },
  { href: "/profil", icon: User, label: "Profil" },
];

// Detect theme from pathname
function getThemeColors(pathname: string) {
  if (pathname === "/forma" || pathname === "/biegacz") {
    return { bg: "bg-[#111111]", border: "border-white/5", active: "#3B82F6", inactive: "rgba(255,255,255,0.25)", isDark: true };
  }
  if (pathname === "/promile") {
    return { bg: "bg-[#0A0A12]", border: "border-white/5", active: "#818CF8", inactive: "rgba(255,255,255,0.2)", isDark: true };
  }
  if (pathname.startsWith("/dashboard") || pathname.startsWith("/profil")) {
    return { bg: "", border: "border-white/5", active: "#6efcb4", inactive: "rgba(255,255,255,0.25)", isDark: true, customBg: "#0a0e0c" };
  }
  // Home (Skanuj) — dark theme
  if (pathname === "/") {
    return { bg: "", border: "border-white/5", active: "#6efcb4", inactive: "rgba(255,255,255,0.25)", isDark: true, customBg: "#0a0e0c" };
  }
  // Default: Matcha (light)
  return { bg: "bg-white", border: "border-gray-200/60", active: "#2E7D32", inactive: "#B0B0B0", isDark: false };
}

export default function BottomNav() {
  const pathname = usePathname();

  // Hide on results pages and admin
  if (pathname.startsWith("/wyniki")) return null;
  if (pathname.startsWith("/admin")) return null;

  const theme = getThemeColors(pathname);

  return (
    <>
      {/* Spacer */}
      <div className="h-20" />

      {/* Fixed nav */}
      <nav
        className={`fixed bottom-0 left-0 right-0 z-[100] border-t transition-colors duration-400 ${theme.bg} ${theme.border}`}
        style={{
          paddingBottom: "env(safe-area-inset-bottom, 0px)",
          boxShadow: theme.isDark ? "none" : "0 -2px 16px rgba(0,0,0,0.06)",
          height: "68px",
          ...("customBg" in theme && theme.customBg ? { background: theme.customBg, backdropFilter: "blur(20px)", WebkitBackdropFilter: "blur(20px)" } : {}),
        }}
      >
        <div className="max-w-md mx-auto flex justify-around items-center h-full px-2">
          {TABS.map((tab) => {
            const isActive = tab.href === "/"
              ? pathname === "/"
              : pathname.startsWith(tab.href);
            const Icon = tab.icon;

            return (
              <Link
                key={tab.href}
                href={tab.href}
                className="relative flex flex-col items-center justify-center min-w-[64px] min-h-[48px] px-3 py-1 transition-all duration-200"
              >
                {/* Active indicator line */}
                {isActive && (
                  <span
                    className="absolute -top-[9px] w-5 h-[3px] rounded-full transition-all duration-300"
                    style={{ backgroundColor: theme.active }}
                  />
                )}

                <Icon
                  size={26}
                  strokeWidth={1.8}
                  style={{ color: isActive ? theme.active : theme.inactive }}
                  className="transition-colors duration-300"
                />
                <span
                  className={`text-[11px] mt-1 leading-none transition-all duration-300 ${
                    isActive ? "font-bold" : "font-medium"
                  }`}
                  style={{ color: isActive ? theme.active : theme.inactive }}
                >
                  {tab.label}
                </span>
              </Link>
            );
          })}
        </div>
      </nav>
    </>
  );
}
