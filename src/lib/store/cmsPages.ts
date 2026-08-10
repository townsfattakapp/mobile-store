import { cache } from "react";
import { createClient } from "@/utils/supabase/server";
import { DEFAULT_STORE_SETTINGS, type StoreSettings } from "@/lib/invoice/types";
import {
  DEFAULT_CONTACT_PAGE_CONTENT,
  DEFAULT_REFUND_POLICY_CONTENT,
  DEFAULT_SHIPPING_POLICY_CONTENT,
  DEFAULT_WARRANTY_CONTENT,
} from "@/lib/store/cmsDefaults";

export type StoreCmsKey =
  | "warranty_content"
  | "refund_policy_content"
  | "shipping_policy_content"
  | "contact_page_content";

export type StoreCmsPages = Pick<StoreSettings, StoreCmsKey>;

const FALLBACKS: Required<StoreCmsPages> = {
  warranty_content: DEFAULT_WARRANTY_CONTENT,
  refund_policy_content: DEFAULT_REFUND_POLICY_CONTENT,
  shipping_policy_content: DEFAULT_SHIPPING_POLICY_CONTENT,
  contact_page_content: DEFAULT_CONTACT_PAGE_CONTENT,
};

function pickCms(row: Partial<StoreSettings> | null | undefined): Required<StoreCmsPages> {
  return {
    warranty_content: String(row?.warranty_content || "").trim() || FALLBACKS.warranty_content,
    refund_policy_content:
      String(row?.refund_policy_content || "").trim() || FALLBACKS.refund_policy_content,
    shipping_policy_content:
      String(row?.shipping_policy_content || "").trim() || FALLBACKS.shipping_policy_content,
    contact_page_content:
      String(row?.contact_page_content || "").trim() || FALLBACKS.contact_page_content,
  };
}

/** Public CMS bodies for policy / contact pages (defaults if DB empty or migration pending). */
export const getStoreCmsPages = cache(async (): Promise<Required<StoreCmsPages>> => {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("store_settings")
      .select(
        "warranty_content, refund_policy_content, shipping_policy_content, contact_page_content"
      )
      .limit(1)
      .maybeSingle();
    if (error || !data) return { ...FALLBACKS };
    return pickCms(data);
  } catch {
    return { ...FALLBACKS };
  }
});

export async function getStoreCmsPage(key: StoreCmsKey): Promise<string> {
  const pages = await getStoreCmsPages();
  return pages[key] ?? "";
}
