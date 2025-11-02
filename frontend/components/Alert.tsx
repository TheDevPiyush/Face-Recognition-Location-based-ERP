"use client";

import { useState } from "react";

type AlertProps = {
  type?: "success" | "error" | "info" | "warning";
  children: React.ReactNode;
  dismissible?: boolean;
};

const typeToClasses: Record<NonNullable<AlertProps["type"]>, string> = {
  success: "border-green-200 bg-green-50 text-green-700",
  error: "border-red-200 bg-red-50 text-red-700",
  info: "border-blue-200 bg-blue-50 text-blue-700",
  warning: "border-yellow-200 bg-yellow-50 text-yellow-700",
};

export default function Alert({ type = "info", children, dismissible = false }: AlertProps) {
  const [open, setOpen] = useState(true);
  if (!open) return null;
  return (
    <div className={`flex items-start gap-3 rounded-md border p-3 text-sm ${typeToClasses[type]}`}>
      <div className="flex-1">{children}</div>
      {dismissible ? (
        <button className="opacity-70 hover:opacity-100" onClick={() => setOpen(false)} aria-label="Dismiss">
          ×
        </button>
      ) : null}
    </div>
  );
}
