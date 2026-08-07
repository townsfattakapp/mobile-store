"use server";

import { getStorefrontProfile } from "@/lib/store/profile";

export async function getStorefrontProfileAction() {
  return getStorefrontProfile();
}
