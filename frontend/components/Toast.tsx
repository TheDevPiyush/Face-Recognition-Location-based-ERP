"use client";

import { useEffect, useState } from "react";

type ToastProps = {
  message: string;
  type?: "success" | "error" | "info";
  duration?: number;
  onClose: () => void;
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

  const colors = {
    success: "bg-green-600 text-white",
    error: "bg-red-600 text-white",
    info: "bg-blue-600 text-white",
  };

  const icons = {
    success: "✓",
    error: "✕",
    info: "i",
  };

  return (
    <div
      className={`fixed bottom-6 right-6 z-50 flex items-center gap-3 rounded-lg px-4 py-3 shadow-lg transition-all ${
        colors[type]
      } ${visible ? "translate-y-0 opacity-100" : "translate-y-2 opacity-0"}`}
      style={{ minWidth: "280px", maxWidth: "400px" }}
    >
      <div className="flex h-6 w-6 items-center justify-center rounded-full bg-white/20 text-sm font-bold">
        {icons[type]}
      </div>
      <div className="flex-1 text-sm">{message}</div>
      <button className="opacity-70 hover:opacity-100" onClick={() => { setVisible(false); setTimeout(onClose, 300); }}>
        ×
      </button>
    </div>
  );
}

