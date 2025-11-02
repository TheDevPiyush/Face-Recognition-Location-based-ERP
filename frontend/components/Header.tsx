"use client";

import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { clearAuth, getCurrentUserStored } from "@/lib/api";
import { useEffect, useState } from "react";

export default function Header() {
  const router = useRouter();
  const pathname = usePathname();
  const [userName, setUserName] = useState<string | null>(null);
  const [role, setRole] = useState<string | null>(null);

  useEffect(() => {
    const u = getCurrentUserStored<any>();
    setUserName(u?.name || u?.email || null);
    setRole(u?.role || (u?.is_staff ? "admin" : null));
  }, [pathname]);

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
    { href: "/profile", label: "Profile" },
  ];
  const adminNav = [{ href: "/manage", label: "Manage" }];

  const isActive = (href: string) => pathname === href;

  return (
    <header className="w-full border-b border-border bg-white">
      <div className="container flex h-14 items-center justify-between">
        <Link href="/" className="font-semibold text-primary">Geofence Attendance</Link>
        <nav className="hidden gap-1 sm:flex">
          {[...nav, ...(role && role !== "student" ? adminNav : [])].map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`rounded-md px-3 py-2 text-sm hover:bg-muted ${isActive(item.href) ? "text-primary" : "opacity-80"}`}
            >
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="flex items-center gap-3">
          {userName ? <span className="hidden sm:block opacity-80">{userName}</span> : null}
          <button className="btn-outline" onClick={onLogout}>Logout</button>
        </div>
      </div>
    </header>
  );
}


