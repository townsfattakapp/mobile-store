"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { createClient } from "@/utils/supabase/client";

export default function UpdatePasswordPage() {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }
    if (password !== confirm) {
      setError("Passwords do not match.");
      return;
    }
    setLoading(true);
    const supabase = createClient();
    const { error: updateError } = await supabase.auth.updateUser({ password });
    setLoading(false);
    if (updateError) {
      setError(updateError.message);
      return;
    }
    router.refresh();
    router.push("/account");
  };

  return (
    <div className="flex min-h-screen flex-col bg-[#fbf8f3]">
      <div className="flex flex-1 items-center justify-center p-4">
        <div className="w-full max-w-md rounded-2xl border border-[#17151f]/10 bg-white p-8 shadow-sm">
          <div className="mb-8 text-center">
            <Link
              href="/"
              className="text-xs font-semibold uppercase tracking-[0.18em] text-[#6e6e73]"
            >
              Mahadev Mobiles
            </Link>
            <h1 className="mt-3 text-2xl font-bold tracking-tight text-[#1d1d1f]">
              Choose a new password
            </h1>
          </div>

          {error ? (
            <div className="mb-4 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-600">
              {error}
            </div>
          ) : null}

          <form onSubmit={onSubmit} className="space-y-4">
            <Input
              label="New password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
              autoComplete="new-password"
            />
            <Input
              label="Confirm password"
              type="password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              required
              minLength={6}
              autoComplete="new-password"
            />
            <Button type="submit" className="w-full" isLoading={loading}>
              Update password
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}
