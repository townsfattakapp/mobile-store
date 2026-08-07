"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { updateProfileAction } from "./actions";

export function ProfileForm({
  fullName,
  phoneNumber,
  email,
}: {
  fullName: string;
  phoneNumber: string;
  email: string;
}) {
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const [pending, startTransition] = useTransition();

  return (
    <form
      className="max-w-md space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        setError("");
        setSaved(false);
        const formData = new FormData(e.currentTarget);
        startTransition(async () => {
          const result = await updateProfileAction(formData);
          if (result?.error) {
            setError(result.error);
            return;
          }
          setSaved(true);
        });
      }}
    >
      <Input label="Email" name="email" value={email} disabled />
      <Input
        label="Full name"
        name="full_name"
        defaultValue={fullName}
        required
        placeholder="Your name"
      />
      <Input
        label="Phone"
        name="phone_number"
        defaultValue={phoneNumber}
        placeholder="10-digit mobile"
        inputMode="tel"
      />

      {error ? (
        <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      ) : null}
      {saved ? (
        <p className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
          Profile saved.
        </p>
      ) : null}

      <Button type="submit" isLoading={pending}>
        Save changes
      </Button>
    </form>
  );
}
