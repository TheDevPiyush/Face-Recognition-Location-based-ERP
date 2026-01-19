"use client";

import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { clearAuth, getCurrentUserStored } from "@/lib/api";
import { useEffect, useMemo, useState } from "react";
import { Button } from "@/app/components/ui/button";
import { Badge } from "@/app/components/ui/badge";
import { cn } from "@/lib/utils";

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
    { href: "/dashboard", label: "Dashboard" },
    { href: "/subjects", label: "Subjects" },
    { href: "/attendance", label: "Attendance" },
    { href: "/analytics", label: "Analytics" },
    { href: "/profile", label: "Profile" },
  ];
  const adminNav = [{ href: "/manage", label: "Manage" }];

  const navItems = [...nav, ...(role && role !== "student" ? adminNav : [])];

  const isActive = (href: string) => pathname === href;

  return (
    <header className="sticky top-0 z-40 flex w-full justify-center px-4 pt-6 sm:pt-8">
      <div className="container">
        <div className="relative flex items-center justify-between rounded-lg border border-border/30 bg-card px-4 py-3 shadow-md backdrop-blur-sm">
          <Link href="/" className="flex items-center gap-3">
            <div className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-primary text-primary-foreground text-base font-semibold">
              ERP
            </div>
            <div className="flex flex-col leading-tight">
              <span className="text-base font-semibold text-foreground">Face & Location ERP</span>
            </div>
          </Link>

          <nav className="hidden items-center gap-2 sm:flex">
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "inline-flex items-center gap-2 rounded-md px-4 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground",
                  isActive(item.href) && "bg-accent text-accent-foreground"
                )}
              >
                {item.label}
              </Link>
            ))}
          </nav>

          <div className="flex items-center gap-2 sm:gap-3">
            {userName ? (
              <div className="hidden items-center gap-2 rounded-md bg-secondary px-3 py-1.5 text-sm font-medium text-secondary-foreground sm:inline-flex">
                <span className="inline-flex h-7 w-7 items-center justify-center rounded-md bg-primary text-primary-foreground text-xs font-semibold">
                  {initials || "U"}
                </span>
                <span className="max-w-[140px] truncate">{userName}</span>
              </div>
            ) : null}
            <Button variant="outline" className="hidden sm:inline-flex" onClick={onLogout}>
              Logout
            </Button>
            <Button
              variant="ghost"
              className="sm:hidden"
              onClick={() => setMenuOpen((prev) => !prev)}
              aria-expanded={menuOpen}
              aria-controls="primary-navigation"
            >
              <span className="sr-only">Toggle navigation</span>
              {menuOpen ? "✕" : "☰"}
            </Button>
          </div>
        </div>
        {menuOpen ? (
          <nav
            id="primary-navigation"
            className="mt-3 flex flex-col gap-2 rounded-lg border bg-card p-4 text-sm shadow-sm sm:hidden"
          >
            {userName ? (
              <div className="flex items-center gap-3 rounded-md bg-secondary px-3 py-2 text-secondary-foreground">
                <span className="inline-flex h-9 w-9 items-center justify-center rounded-md bg-primary text-primary-foreground text-sm font-semibold">
                  {initials || "U"}
                </span>
                <div className="flex flex-col">
                  <span className="text-sm font-semibold text-foreground">{userName}</span>
                  {role ? <span className="text-xs uppercase tracking-[0.14em] text-muted-foreground">{role}</span> : null}
                </div>
              </div>
            ) : null}
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "inline-flex items-center justify-between gap-2 rounded-md px-5 py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground",
                  isActive(item.href) && "bg-accent text-accent-foreground"
                )}
              >
                {item.label}
              </Link>
            ))}
            <Button className="w-full" onClick={onLogout}>
              Logout
            </Button>
          </nav>
        ) : null}
      </div>
    </header>
  );
}
