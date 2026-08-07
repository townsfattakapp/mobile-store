"use client";

import React, { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { createClient } from "@/utils/supabase/client";

function siteOrigin() {
  if (typeof window !== "undefined") return window.location.origin;
  return process.env.NEXT_PUBLIC_SITE_URL || "";
}

export default function SignupClient() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [needsEmailConfirm, setNeedsEmailConfirm] = useState(false);
  const router = useRouter();
  const searchParams = useSearchParams();

  const nextPath = useMemo(() => {
    const raw = searchParams.get("next") || "/account";
    if (!raw.startsWith("/") || raw.startsWith("//")) return "/account";
    return raw;
  }, [searchParams]);

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setIsLoading(true);
    const supabase = createClient();

    const { data, error: authError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: name },
        emailRedirectTo: `${siteOrigin()}/auth/callback?next=${encodeURIComponent(nextPath)}`,
      },
    });

    if (authError) {
      setError(authError.message);
      setIsLoading(false);
      return;
    }

    if (data.user && data.user.identities && data.user.identities.length === 0) {
      setError("An account with this email already exists.");
      setIsLoading(false);
      return;
    }

    // Session present = email confirmations disabled → go to account
    if (data.session) {
      // Ensure profile via API route isn't needed; requireCustomer uses admin upsert
      router.refresh();
      router.push(nextPath);
      return;
    }

    setNeedsEmailConfirm(true);
    setSuccess(true);
    setIsLoading(false);
  };

  const handleGoogleSignup = async () => {
    setError("");
    const supabase = createClient();
    const redirectTo = `${siteOrigin()}/auth/callback?next=${encodeURIComponent(nextPath)}`;
    const { error: oauthErr } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo },
    });
    if (oauthErr) setError(oauthErr.message);
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
              Create an account
            </h1>
            <p className="mt-1 text-sm text-[#6e6e73]">
              Track orders and save addresses for faster checkout
            </p>
          </div>

          {error && (
            <div className="mb-4 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-600">
              {error}
            </div>
          )}

          {success ? (
            <div className="py-4 text-center">
              <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-green-100 text-green-600">
                <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M5 13l4 4L19 7"
                  />
                </svg>
              </div>
              <h3 className="mb-2 text-lg font-bold">
                {needsEmailConfirm ? "Check your email" : "Account created"}
              </h3>
              <p className="mb-6 text-sm text-[#424245]">
                {needsEmailConfirm
                  ? "We sent a confirmation link. After verifying, you can sign in."
                  : "You’re all set."}
              </p>
              <Link href={`/login?next=${encodeURIComponent(nextPath)}`}>
                <Button className="w-full">Go to Login</Button>
              </Link>
            </div>
          ) : (
            <>
              <form onSubmit={handleSignup} className="mb-6 space-y-4">
                <Input
                  label="Full Name"
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Your name"
                  required
                  autoComplete="name"
                />
                <Input
                  label="Email Address"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  required
                  autoComplete="email"
                />
                <Input
                  label="Password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Minimum 6 characters"
                  required
                  minLength={6}
                  autoComplete="new-password"
                />

                <Button type="submit" className="w-full" isLoading={isLoading}>
                  Create Account
                </Button>
              </form>

              <div className="relative mb-6">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-neutral-200" />
                </div>
                <div className="relative flex justify-center text-sm">
                  <span className="bg-white px-2 text-[#6e6e73]">Or continue with</span>
                </div>
              </div>

              <Button
                variant="outline"
                className="mb-6 w-full"
                onClick={handleGoogleSignup}
                type="button"
              >
                Sign up with Google
              </Button>

              <p className="text-center text-sm text-[#424245]">
                Already have an account?{" "}
                <Link
                  href={`/login?next=${encodeURIComponent(nextPath)}`}
                  className="font-medium text-black hover:underline"
                >
                  Sign in
                </Link>
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
