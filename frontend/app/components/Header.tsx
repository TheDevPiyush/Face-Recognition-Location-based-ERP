"use client";

import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { clearAuth, getCurrentUserStored } from "@/lib/api";
import { useEffect, useMemo, useState } from "react";

export default function Header() {
  const router = useRouter();
  const pathname = usePathname();
  const [userName, setUserName] = useState<string | null>(null);
  const [role, setRole] = useState<string | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    const u = getCurrentUserStored<any>();
    setUserName(u?.name || u?.email || null);
    setRole(u?.role || (u?.is_staff ? "admin" : null));
    setMenuOpen(false);
  }, [pathname]);

  const initials = useMemo(() => {
    if (!userName) return null;
    return userName
      .split(" ")
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part.charAt(0).toUpperCase())
      .join("");
  }, [userName]);

  const onLogout = () => {
    clearAuth();
    router.replace("/login");
  };

  // Hide header on auth pages
  if (pathname === "/login") return null;

  const nav = [
    { href: "/dashboard", label: "Dashboard", emoji: "✨" },
    { href: "/subjects", label: "Subjects", emoji: "📚" },
    { href: "/attendance", label: "Attendance", emoji: "🕒" },
    { href: "/profile", label: "Profile", emoji: "🌸" },
  ];
  const adminNav = [{ href: "/manage", label: "Manage", emoji: "🧑‍💻" }];

  const navItems = [...nav, ...(role && role !== "student" ? adminNav : [])];

  const isActive = (href: string) => pathname === href;

  return (
    <header className="sticky top-0 z-40 flex w-full justify-center px-4 pt-6 sm:pt-8">
      <div className="container">
        <div className="relative flex items-center justify-between rounded-3xl border border-white/60 bg-white/80 px-4 py-3 shadow-md backdrop-blur-xl transition-all">
          <Link href="/" className="flex items-center gap-2">
            <span className="inline-flex h-9 w-9 items-center justify-center rounded-2xl bg-primary/15 text-base font-semibold text-primary">
              🧭
            </span>
            <div className="flex flex-col leading-tight">
              <span className="text-sm font-semibold text-[var(--muted-foreground)]">
                CIMAGE ERP
              </span>
              <span className="text-base font-semibold text-foreground">Geofence Attendance</span>
            </div>
          </Link>

          <nav className="hidden items-center gap-2 sm:flex">
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={`link-pill ${isActive(item.href) ? "bg-primary/20 text-primary shadow-sm" : ""}`}
              >
                <span>{item.emoji}</span>
                {item.label}
              </Link>
            ))}
          </nav>

          <div className="flex items-center gap-2 sm:gap-3">
            {userName ? (
              <div className="hidden items-center gap-2 rounded-full bg-white/80 px-3 py-1.5 text-sm font-medium text-[var(--muted-foreground)] sm:inline-flex">
                <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-primary/15 text-xs font-semibold text-primary">
                  {initials || "🙂"}
                </span>
                <span className="max-w-[140px] truncate">{userName}</span>
              </div>
            ) : null}
            <button className="btn-outline hidden sm:inline-flex" onClick={onLogout}>
              Logout
            </button>
            <button
              className="btn-ghost sm:hidden"
              onClick={() => setMenuOpen((prev) => !prev)}
              aria-expanded={menuOpen}
              aria-controls="primary-navigation"
            >
              <span className="sr-only">Toggle navigation</span>
              {menuOpen ? "✕" : "☰"}
            </button>
          </div>
        </div>
        {menuOpen ? (
          <nav
            id="primary-navigation"
            className="mt-3 flex flex-col gap-2 rounded-3xl border border-white/40 bg-white/90 p-4 text-sm shadow-md backdrop-blur-xl sm:hidden"
          >
            {userName ? (
              <div className="flex items-center gap-3 rounded-2xl bg-white/80 px-3 py-2 text-[var(--muted-foreground)]">
                <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-primary/15 text-sm font-semibold text-primary">
                  {initials || "🙂"}
                </span>
                <div className="flex flex-col">
                  <span className="text-sm font-semibold text-foreground">{userName}</span>
                  {role ? <span className="text-xs uppercase tracking-[0.14em] text-[var(--muted-foreground)]">{role}</span> : null}
                </div>
              </div>
            ) : null}
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={`link-pill justify-between px-5 py-2.5 ${isActive(item.href) ? "bg-primary/20 text-primary shadow-sm" : ""}`}
              >
                <span className="flex items-center gap-2">
                  <span>{item.emoji}</span>
                  {item.label}
                </span>
                <span className="text-xs text-[var(--muted-foreground)]">→</span>
              </Link>
            ))}
            <button className="btn w-full" onClick={onLogout}>
              Logout
            </button>
          </nav>
        ) : null}
      </div>
    </header>
  );
}
