"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { createClient } from "@/utils/supabase/client";
import { Header } from "@/components/storefront/Header";
import { Footer } from "@/components/storefront/Footer";

export default function AccountPage() {
  const [user, setUser] = useState<any>(null);
  const router = useRouter();

  useEffect(() => {
    const fetchUser = async () => {
      // Create a fresh client inside the effect so it isn't a dependency
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.push("/login");
      } else {
        setUser(user);
      }
    };
    fetchUser();
  }, [router]);

  const handleSignOut = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
  };

  if (!user) return <div className="min-h-screen flex items-center justify-center">Loading...</div>;

  return (
    <div className="flex flex-col min-h-screen bg-neutral-50">
      <Header />
      <div className="flex-1 container mx-auto max-w-4xl p-4 py-8">
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-2xl font-bold tracking-tight">My Account</h1>
          <Button onClick={handleSignOut} variant="outline">Sign Out</Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="md:col-span-1 space-y-2">
            <div className="bg-white rounded-xl border p-4 font-medium text-black cursor-pointer shadow-sm">
              Dashboard
            </div>
            <div className="bg-white rounded-xl border p-4 text-[#424245] hover:bg-neutral-50 cursor-pointer">
              Orders
            </div>
            <div className="bg-white rounded-xl border p-4 text-[#424245] hover:bg-neutral-50 cursor-pointer">
              Addresses
            </div>
          </div>
          
          <div className="md:col-span-2">
            <div className="bg-white rounded-xl border p-6 shadow-sm">
              <h2 className="text-lg font-bold mb-4">Profile Details</h2>
              <div className="space-y-4">
                <div>
                  <label className="text-sm text-[#6e6e73]">Email Address</label>
                  <p className="font-medium text-black">{user.email}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      <Footer />
    </div>
  );
}
