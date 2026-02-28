"use client";

import { useState } from "react";

type AlertProps = {
  type?: "success" | "error" | "info" | "warning";
  children: React.ReactNode;
  dismissible?: boolean;
  title?: string;
};

const styles: Record<NonNullable<AlertProps["type"]>, { bg: string; text: string; border: string; icon: string; emoji: string }> = {
  success: {
    bg: "bg-emerald-50/80",
    text: "text-emerald-700",
    border: "border-emerald-200/70",
    icon: "text-emerald-500",
    emoji: "🌱",
  },
  error: {
    bg: "bg-rose-50/80",
    text: "text-rose-700",
    border: "border-rose-200/70",
    icon: "text-rose-500",
    emoji: "⚠️",
  },
  info: {
    bg: "bg-sky-50/80",
    text: "text-sky-700",
    border: "border-sky-200/70",
    icon: "text-sky-500",
    emoji: "💡",
  },
  warning: {
    bg: "bg-amber-50/80",
    text: "text-amber-700",
    border: "border-amber-200/70",
    icon: "text-amber-500",
    emoji: "⛅",
  },
};

export default function Alert({ type = "info", children, dismissible = false, title }: AlertProps) {
  const [open, setOpen] = useState(true);
  if (!open) return null;
  const style = styles[type];
  return (
    <div
      role="alert"
      className={`flex items-start gap-3 rounded-2xl border px-4 py-3 text-sm shadow-sm backdrop-blur ${style.bg} ${style.border} ${style.text}`}
    >
      <span className={`mt-0.5 text-lg ${style.icon}`} aria-hidden>
        {style.emoji}
      </span>
      <div className="flex-1 space-y-1">
        {title ? <div className="text-sm font-semibold">{title}</div> : null}
        <div className="leading-relaxed">{children}</div>
      </div>
      {dismissible ? (
        <button
          className="btn-ghost -mr-2 -mt-2 rounded-full px-2 py-1 text-xs font-semibold uppercase tracking-[0.18em]"
          onClick={() => setOpen(false)}
          aria-label="Dismiss alert"
        >
          Close
        </button>
      ) : null}
    </div>
  );
}
