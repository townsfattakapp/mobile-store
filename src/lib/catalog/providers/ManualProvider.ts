import { createClient } from "@/utils/supabase/client";
import { CatalogProvider, MasterDevice } from "../CatalogProvider";

/**
 * ManualProvider is the default implementation that queries our local 
 * master catalog stored in Supabase. It assumes the data has already 
 * been verified or populated manually by the store admin.
 */
export class ManualProvider implements CatalogProvider {
  private supabase = createClient();

  async searchDevices(query: string): Promise<MasterDevice[]> {
    if (!query.trim()) return [];

    const { data, error } = await this.supabase
      .from("master_devices")
      .select(`
        *,
        brand:brands(name),
        variants:master_device_variants(*)
      `)
      .ilike("model_name", `%${query}%`)
      .order("release_year", { ascending: false })
      .limit(20);

    if (error) {
      console.error("ManualProvider search error:", error);
      return [];
    }

    return data as MasterDevice[];
  }

  async getDeviceDetails(externalId: string): Promise<MasterDevice | null> {
    // For ManualProvider, externalId is just our internal Supabase UUID
    const { data, error } = await this.supabase
      .from("master_devices")
      .select(`
        *,
        brand:brands(name),
        variants:master_device_variants(*)
      `)
      .eq("id", externalId)
      .single();

    if (error || !data) {
      console.error("ManualProvider detail error:", error);
      return null;
    }

    return data as MasterDevice;
  }

  async syncRecentReleases(brandName: string): Promise<void> {
    // ManualProvider doesn't fetch from external APIs, so sync is a no-op
    // Future providers (e.g. GsmArenaProvider) would implement this logic.
    console.log(`Sync requested for ${brandName}, but using ManualProvider (No-op)`);
  }
}

// Export a singleton instance
export const manualProvider = new ManualProvider();
