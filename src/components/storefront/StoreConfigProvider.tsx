"use client";

import React, { createContext, useContext } from "react";
import {
  DEFAULT_STOREFRONT_PROFILE,
  type StorefrontProfile,
} from "@/lib/store/profile-shared";

const StoreConfigContext = createContext<StorefrontProfile>(DEFAULT_STOREFRONT_PROFILE);

export function StoreConfigProvider({
  value,
  children,
}: {
  value: StorefrontProfile;
  children: React.ReactNode;
}) {
  return (
    <StoreConfigContext.Provider value={value}>{children}</StoreConfigContext.Provider>
  );
}

export function useStoreConfig() {
  return useContext(StoreConfigContext);
}
