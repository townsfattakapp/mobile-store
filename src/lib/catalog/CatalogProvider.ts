export type MasterVariant = {
  id: string;
  master_device_id: string;
  ram: string | null;
  storage: string | null;
  color: string | null;
  /** Optional — scrapers / enrichers may omit until an image is resolved */
  reference_image_url?: string | null;
};

export type MasterDevice = {
  id: string;
  brand_id: string;
  model_name: string;
  slug: string;
  release_year: number | null;
  device_type?: "smartphone" | "tablet" | "accessory" | "part";
  specifications: Record<string, any>;
  source_provider: string;
  source_external_id?: string | null;
  is_verified?: boolean;
  /** Present on some scrapes / admin UI even when not persisted on master row */
  main_image_url?: string | null;
  /** Transient scrape hint before brand_id is resolved */
  brand_name?: string;
  variants?: MasterVariant[];
  brand?: { name: string };
};

export interface CatalogProvider {
  /**
   * Search for devices across the catalog
   */
  searchDevices(query: string): Promise<MasterDevice[]>;

  /**
   * Get full details of a specific device, including its variants
   */
  getDeviceDetails(externalId: string): Promise<MasterDevice | null>;

  /**
   * Fetch recent models for a brand and synchronize them with the local DB
   */
  syncRecentReleases(brandName: string): Promise<void>;
}
