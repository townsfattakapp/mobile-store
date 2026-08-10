"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { Archive, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/Button";

type Props = {
  mode: "archive" | "restore";
  label?: string;
  confirmTitle: string;
  defaultReason?: string;
  askReason?: boolean;
  onConfirm: (reason: string) => Promise<{ error?: string; success?: boolean; warning?: string }>;
  variant?: "outline" | "primary" | "secondary" | "ghost";
  className?: string;
  size?: "sm" | "md" | "lg";
};

export function SoftDeleteButton({
  mode,
  label,
  confirmTitle,
  defaultReason = "Archived by admin",
  askReason = true,
  onConfirm,
  variant = "outline",
  className = "",
  size = "sm",
}: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  const handleClick = async () => {
    let reason = defaultReason;
    if (mode === "archive" && askReason) {
      const entered = window.prompt(confirmTitle, defaultReason);
      if (entered == null) return;
      reason = entered.trim() || defaultReason;
    } else if (!window.confirm(confirmTitle)) {
      return;
    }

    setBusy(true);
    const res = await onConfirm(reason);
    setBusy(false);

    if (res.error) {
      alert(res.error);
      return;
    }
    if (res.warning) alert(res.warning);
    router.refresh();
  };

  return (
    <Button
      type="button"
      variant={variant}
      size={size}
      className={`gap-2 ${mode === "archive" ? "text-red-600 border-red-200 hover:bg-red-50" : ""} ${className}`}
      onClick={handleClick}
      isLoading={busy}
    >
      {mode === "archive" ? <Archive className="w-4 h-4" /> : <RotateCcw className="w-4 h-4" />}
      {label || (mode === "archive" ? "Archive" : "Restore")}
    </Button>
  );
}
