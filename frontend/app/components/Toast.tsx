"use client";

import { useEffect, useState } from "react";

type ToastProps = {
  message: string;
  type?: "success" | "error" | "info";
  duration?: number;
  onClose: () => void;
};

const variants: Record<NonNullable<ToastProps["type"]>, { bg: string; accent: string; icon: string; emoji: string }> = {
  success: {
    bg: "from-emerald-400/15 via-emerald-300/10 to-white/80",
    accent: "bg-emerald-400/30 text-emerald-600",
    icon: "text-emerald-500",
    emoji: "🌷",
  },
  error: {
    bg: "from-rose-400/20 via-rose-300/12 to-white/80",
    accent: "bg-rose-400/30 text-rose-600",
    icon: "text-rose-500",
    emoji: "💔",
  },
  info: {
    bg: "from-sky-400/20 via-sky-300/12 to-white/80",
    accent: "bg-sky-400/25 text-sky-600",
    icon: "text-sky-500",
    emoji: "💙",
  },
};

export default function Toast({ message, type = "info", duration = 4000, onClose }: ToastProps) {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => {
      setVisible(false);
      setTimeout(onClose, 300);
    }, duration);
    return () => clearTimeout(timer);
  }, [duration, onClose]);

  const variant = variants[type];

  return (
    <div
      className={`fixed bottom-6 right-6 z-50 flex min-w-[280px] max-w-[380px] items-center gap-3 rounded-3xl border border-white/50 bg-gradient-to-br px-5 py-4 text-sm text-foreground shadow-xl backdrop-blur-xl transition-all ${
        variant.bg
      } ${visible ? "translate-y-0 opacity-100" : "translate-y-2 opacity-0"}`}
    >
      <div className={`flex h-9 w-9 items-center justify-center rounded-2xl text-base font-semibold ${variant.accent}`}>
        <span className={variant.icon} aria-hidden>
          {variant.emoji}
        </span>
      </div>
      <div className="flex-1 leading-relaxed">{message}</div>
      <button
        className="btn-ghost -mr-2 rounded-full px-2 py-1 text-xs font-semibold uppercase tracking-[0.18em]"
        onClick={() => {
          setVisible(false);
          setTimeout(onClose, 300);
        }}
        aria-label="Dismiss toast"
      >
        Close
      </button>
    </div>
  );
}