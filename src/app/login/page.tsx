import { Suspense } from "react";
import LoginClient from "./LoginClient";

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-[#fbf8f3] text-sm text-[#6e6e73]">
          Loading…
        </div>
      }
    >
      <LoginClient />
    </Suspense>
  );
}
