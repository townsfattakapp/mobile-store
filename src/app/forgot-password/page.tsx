"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { createClient } from "@/utils/supabase/client";

function siteOrigin() {
  if (typeof window !== "undefined") return window.location.origin;
  return process.env.NEXT_PUBLIC_SITE_URL || "";
}

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    const supabase = createClient();
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${siteOrigin()}/auth/callback?next=${encodeURIComponent("/update-password")}`,
    });
    setLoading(false);
    if (resetError) {
      setError(resetError.message);
      return;
    }
    setSent(true);
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
              Reset password
            </h1>
            <p className="mt-1 text-sm text-[#6e6e73]">
              We’ll email you a link to choose a new password
            </p>
          </div>

          {error ? (
            <div className="mb-4 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-600">
              {error}
            </div>
          ) : null}

          {sent ? (
            <div className="space-y-4 text-center">
              <p className="text-sm text-[#424245]">
                If an account exists for <strong>{email}</strong>, you’ll receive a reset link
                shortly.
              </p>
              <Link href="/login">
                <Button className="w-full">Back to login</Button>
              </Link>
            </div>
          ) : (
            <form onSubmit={onSubmit} className="space-y-4">
              <Input
                label="Email Address"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
              />
              <Button type="submit" className="w-full" isLoading={loading}>
                Send reset link
              </Button>
              <p className="text-center text-sm">
                <Link href="/login" className="font-medium text-black hover:underline">
                  Back to login
                </Link>
              </p>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
