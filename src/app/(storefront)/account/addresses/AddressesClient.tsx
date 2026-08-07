"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import {
  addAddressAction,
  deleteAddressAction,
  setDefaultAddressAction,
} from "../actions";

export type AddressRow = {
  id: string;
  full_name: string;
  mobile_number: string;
  address_line: string;
  landmark: string | null;
  city: string;
  state: string;
  pin_code: string;
  type: string;
  is_default: boolean;
};

export function AddressesClient({ addresses }: { addresses: AddressRow[] }) {
  const [error, setError] = useState("");
  const [showForm, setShowForm] = useState(addresses.length === 0);
  const [pending, startTransition] = useTransition();

  return (
    <div className="space-y-6">
      <ul className="space-y-3">
        {addresses.map((addr) => (
          <li
            key={addr.id}
            className="rounded-2xl border border-[#17151f]/10 bg-white px-4 py-4"
          >
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <p className="font-medium text-[#1d1d1f]">
                  {addr.full_name}
                  {addr.is_default ? (
                    <span className="ml-2 text-xs font-semibold uppercase tracking-wide text-emerald-700">
                      Default
                    </span>
                  ) : null}
                </p>
                <p className="mt-1 text-sm capitalize text-[#6e6e73]">{addr.type}</p>
                <p className="mt-2 whitespace-pre-line text-sm text-[#424245]">
                  {[
                    addr.mobile_number,
                    addr.address_line,
                    addr.landmark,
                    `${addr.city}, ${addr.state} ${addr.pin_code}`,
                  ]
                    .filter(Boolean)
                    .join("\n")}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                {!addr.is_default ? (
                  <button
                    type="button"
                    className="text-xs font-medium text-[#3b2f7c] underline-offset-2 hover:underline"
                    disabled={pending}
                    onClick={() => {
                      setError("");
                      startTransition(async () => {
                        const r = await setDefaultAddressAction(addr.id);
                        if (r?.error) setError(r.error);
                      });
                    }}
                  >
                    Set default
                  </button>
                ) : null}
                <button
                  type="button"
                  className="text-xs font-medium text-red-600 underline-offset-2 hover:underline"
                  disabled={pending}
                  onClick={() => {
                    if (!confirm("Delete this address?")) return;
                    setError("");
                    startTransition(async () => {
                      const r = await deleteAddressAction(addr.id);
                      if (r?.error) setError(r.error);
                    });
                  }}
                >
                  Delete
                </button>
              </div>
            </div>
          </li>
        ))}
      </ul>

      {!showForm ? (
        <Button type="button" variant="outline" onClick={() => setShowForm(true)}>
          Add address
        </Button>
      ) : (
        <form
          className="max-w-md space-y-3 rounded-2xl border border-[#17151f]/10 bg-white p-4"
          onSubmit={(e) => {
            e.preventDefault();
            setError("");
            const formData = new FormData(e.currentTarget);
            startTransition(async () => {
              const r = await addAddressAction(formData);
              if (r?.error) {
                setError(r.error);
                return;
              }
              setShowForm(false);
              e.currentTarget.reset();
            });
          }}
        >
          <p className="text-sm font-semibold text-[#1d1d1f]">New address</p>
          <Input label="Full name" name="full_name" required />
          <Input label="Mobile" name="mobile_number" required inputMode="tel" />
          <Input label="Address" name="address_line" required />
          <Input label="Landmark (optional)" name="landmark" />
          <div className="grid grid-cols-2 gap-3">
            <Input label="City" name="city" required />
            <Input label="State" name="state" required defaultValue="Maharashtra" />
          </div>
          <Input label="PIN code" name="pin_code" required inputMode="numeric" />
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-[#1d1d1f]">Type</label>
            <select
              name="type"
              defaultValue="home"
              className="h-10 rounded-md border border-neutral-300 bg-white px-3 text-sm"
            >
              <option value="home">Home</option>
              <option value="work">Work</option>
              <option value="other">Other</option>
            </select>
          </div>
          <label className="flex items-center gap-2 text-sm text-[#424245]">
            <input type="checkbox" name="is_default" className="rounded" />
            Set as default
          </label>
          <div className="flex gap-2 pt-1">
            <Button type="submit" isLoading={pending}>
              Save address
            </Button>
            {addresses.length > 0 ? (
              <Button type="button" variant="ghost" onClick={() => setShowForm(false)}>
                Cancel
              </Button>
            ) : null}
          </div>
        </form>
      )}

      {error ? (
        <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      ) : null}
    </div>
  );
}
