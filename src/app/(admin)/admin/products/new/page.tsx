"use client";

import React, { useEffect, useMemo, useState } from "react";
import { createClient } from "@/utils/supabase/client";
import { manualProvider } from "@/lib/catalog/providers/ManualProvider";
import { MasterDevice, MasterVariant } from "@/lib/catalog/CatalogProvider";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { ArrowLeft, Save, Search, CheckCircle2, ImageOff } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  autoFetchAndSaveMasterDevice,
  bulkScrapeCategoryLinks,
  smartScrapeOrExpand,
  bulkImportDiscoveredLinks,
  publishCatalogProduct,
} from "./actions";
import { pickSmartCategoryId } from "@/lib/catalog/categorySmart";
import {
  lookupAppleIndiaMrp,
  lookupAppleVariantMrp,
} from "@/lib/catalog/scraper/appleInPrices";
import { formatStoreProductName } from "@/lib/catalog/scraper/extractProductImages";
import { ManualProductForm } from "./ManualProductForm";

type DiscoveredLink = { name: string; url: string; image?: string };

export default function NewProductPage() {
    const router = useRouter();
    const supabase = createClient();
  
    // Mode Selection
    const [mode, setMode] = useState<"search" | "manual" | "configure">("search");
    
    // Search State
    const [searchQuery, setSearchQuery] = useState("");
    const [searchResults, setSearchResults] = useState<MasterDevice[]>([]);
    const [scrapedLinks, setScrapedLinks] = useState<DiscoveredLink[]>([]);
    const [listFilter, setListFilter] = useState("");
    const [isSearching, setIsSearching] = useState(false);
    const [fetchingUrl, setFetchingUrl] = useState<string | null>(null);
    const [isBulkScraping, setIsBulkScraping] = useState(false);
    const [isImportingAll, setIsImportingAll] = useState(false);
    const [discoverMessage, setDiscoverMessage] = useState("");
    const [importProgress, setImportProgress] = useState("");

    const filteredScrapedLinks = useMemo(() => {
      const q = listFilter.trim().toLowerCase();
      if (!q) return scrapedLinks;
      return scrapedLinks.filter(
        (link) =>
          link.name.toLowerCase().includes(q) ||
          link.url.toLowerCase().includes(q)
      );
    }, [scrapedLinks, listFilter]);
  
    // Selected Master Device
    const [selectedDevice, setSelectedDevice] = useState<MasterDevice | null>(null);
    
    // Configuration State (Commercial Data)
    const [variantsConfig, setVariantsConfig] = useState<Record<string, { mrp: string, price: string, stock: string, active: boolean }>>({});
    const [productType, setProductType] = useState("new_mobile");
    const [categoryId, setCategoryId] = useState("");
    const [saving, setSaving] = useState(false);
    const [formError, setFormError] = useState<string | null>(null);
    const [taxRate, setTaxRate] = useState("18");
    const [shortDescription, setShortDescription] = useState("");
    const [productName, setProductName] = useState("");
  
    // Lookups
    const [categories, setCategories] = useState<{id: string, name: string, slug?: string | null}[]>([]);
    const [brands, setBrands] = useState<{id: string, name: string}[]>([]);

    useEffect(() => {
      const fetchLookups = async () => {
        let { data } = await supabase
          .from("categories")
          .select("id, name, slug")
          .order("name");

        // Ensure a proper phone category exists (avoid Batteries-as-default trap)
        const hasPhoneCat = (data || []).some((c) =>
          /smart\s*phone|smartphone|\bmobiles?\b|\bphones?\b/i.test(c.name)
        );
        if (!hasPhoneCat) {
          const { data: created } = await supabase
            .from("categories")
            .upsert(
              {
                name: "Smartphones",
                slug: "smartphones",
                description: "New and pre-owned mobile phones",
                active: true,
              },
              { onConflict: "slug" }
            )
            .select("id, name, slug")
            .single();
          if (created) {
            data = [...(data || []), created];
          }
        }

        if (data) {
          setCategories(data);
          setCategoryId(pickSmartCategoryId(data, "new_mobile"));
        }

        const { data: brandRows } = await supabase
          .from("brands")
          .select("id, name")
          .order("name");
        if (brandRows) setBrands(brandRows);
      };
      fetchLookups();
    }, []);

    // Keep category aligned when product type changes
    useEffect(() => {
      if (categories.length === 0) return;
      setCategoryId(
        pickSmartCategoryId(
          categories,
          productType,
          selectedDevice?.model_name
        )
      );
    }, [productType]);
  
    useEffect(() => {
      // Debounced Search — also auto-expand Apple/category URLs into model list
      const timer = setTimeout(async () => {
        if (searchQuery.trim().length > 2) {
          setIsSearching(true);
          setScrapedLinks([]);
          setListFilter("");
          setDiscoverMessage("");
          const results = await manualProvider.searchDevices(searchQuery);
          setSearchResults(results);

          const isUrl =
            searchQuery.startsWith("http://") || searchQuery.startsWith("https://");
          if (isUrl && results.length === 0) {
            // Auto-scan category / brand pages so user sees models immediately
            const scan = await bulkScrapeCategoryLinks(searchQuery);
            if (scan.success && scan.items && scan.items.length > 0) {
              setScrapedLinks(scan.items as DiscoveredLink[]);
              setListFilter("");
              setDiscoverMessage(
                scan.message || `Found ${scan.items.length} models on this page`
              );
            }
          }
          setIsSearching(false);
        } else {
          setSearchResults([]);
          setScrapedLinks([]);
          setListFilter("");
          setDiscoverMessage("");
        }
      }, 500);
      return () => clearTimeout(timer);
    }, [searchQuery]);
  
    const handleSelectDevice = async (deviceId: string) => {
      const device = await manualProvider.getDeviceDetails(deviceId);
      if (!device) {
        alert(
          "Device was saved but could not be loaded from Master Catalog. Try searching for it by name."
        );
        return false;
      }
      if (!(device as any).main_image_url) {
        (device as any).main_image_url =
          device.variants?.[0]?.reference_image_url ||
          device.specifications?.main_image_url;
      }
      setSelectedDevice(device);
      setFormError(null);
      const niceName = formatStoreProductName(
        device.model_name,
        device.brand?.name
      );
      setProductName(niceName);
      setShortDescription(niceName);
      setTaxRate("18");

      // Auto-pick accessory type ONLY for clear accessories (not phones)
      const specType = String(device.specifications?.product_type || "");
      const looksPhone =
        /iphone|smartphone|5g|pova|galaxy|pixel|camon|spark|android/i.test(
          device.model_name || ""
        ) || specType === "mobile";
      const looksAccessory =
        !looksPhone &&
        (specType === "accessory" ||
          /power\s*bank|charger|cable|earbuds|vacuum|mouse|neckband/i.test(
            device.model_name || ""
          ));
      if (looksAccessory) {
        setProductType("accessory");
      } else if (looksPhone) {
        setProductType("new_mobile");
      }

      if (categories.length) {
        setCategoryId(
          pickSmartCategoryId(
            categories,
            looksAccessory ? "accessory" : looksPhone ? "new_mobile" : productType,
            device.model_name
          )
        );
      }

      const pricingList: any[] = Array.isArray(device.specifications?.variant_pricing)
        ? device.specifications.variant_pricing
        : [];

      const colorImages: Record<string, string> =
        device.specifications?.color_images || {};

      // Backfill missing variant thumbnails from color_images map
      if (device.variants?.length) {
        device.variants = device.variants.map((v) => {
          if (v.reference_image_url) return v;
          const img =
            colorImages[v.color || ""] ||
            Object.entries(colorImages).find(
              ([k]) => k.toLowerCase() === String(v.color || "").toLowerCase()
            )?.[1];
          return img ? { ...v, reference_image_url: img } : v;
        });
      }

      let fallbackMrp = Number(device.specifications?.mrp) || 0;
      if (!fallbackMrp) {
        const brand = device.brand?.name?.toLowerCase() || "";
        if (brand.includes("apple") || /iphone/i.test(device.model_name)) {
          const curated = lookupAppleIndiaMrp(device.model_name);
          if (curated) fallbackMrp = curated;
        }
      }

      const findPrice = (v: MasterVariant) => {
        const hit = pricingList.find(
          (p) =>
            String(p.color || "").toLowerCase() === String(v.color || "").toLowerCase() &&
            String(p.storage || "").replace(/\s/g, "").toUpperCase() ===
              String(v.storage || "").replace(/\s/g, "").toUpperCase()
        );
        if (hit?.mrp) return Number(hit.mrp);
        const byStorage = pricingList.find(
          (p) =>
            String(p.storage || "").replace(/\s/g, "").toUpperCase() ===
            String(v.storage || "").replace(/\s/g, "").toUpperCase()
        );
        if (byStorage?.mrp) return Number(byStorage.mrp);

        const brand = device.brand?.name?.toLowerCase() || "";
        if (
          (brand.includes("apple") || /iphone/i.test(device.model_name)) &&
          v.storage
        ) {
          const byTier = lookupAppleVariantMrp(device.model_name, v.storage);
          if (byTier) return byTier;
        }
        return fallbackMrp;
      };

      const config: Record<string, any> = {};
      if (!device.variants?.length) {
        // Allow publishing scraped devices that only have a base SKU
        device.variants = [
          {
            id: "standard",
            master_device_id: device.id,
            ram: "",
            storage: "Standard",
            color: "Default",
            reference_image_url:
              (device as any).main_image_url ||
              device.specifications?.main_image_url ||
              "",
          } as MasterVariant,
        ];
      }
      device.variants.forEach((v) => {
        const mrp = findPrice(v);
        const mrpStr = mrp > 0 ? String(mrp) : "";
        config[v.id] = {
          mrp: mrpStr,
          price: mrpStr,
          stock: "4",
          active: true,
        };
      });
      setVariantsConfig(config);
      setMode("configure");
      return true;
    };

    const handleAutoFetch = async (queryToFetch?: string) => {
      const q = queryToFetch || searchQuery;
      if (!q || q.trim().length < 3) return;
      setFetchingUrl(q);
      setDiscoverMessage("");

      // URLs: use reliable API route (service-role save + Samsung API-first)
      if (q.startsWith("http://") || q.startsWith("https://")) {
        try {
          const res = await fetch("/api/admin/catalog/import-url", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ url: q }),
          });
          const smart = await res.json();
          if (!res.ok || !smart.success) {
            // Fall back to server action if API auth/route fails
            const fallback = await smartScrapeOrExpand(q);
            if (!fallback.success) {
              alert(
                "Failed: " +
                  (smart.error || fallback.error || "Unknown error")
              );
              setFetchingUrl(null);
              return;
            }
            if (fallback.mode === "expand") {
              setScrapedLinks((fallback.items || []) as DiscoveredLink[]);
              setListFilter("");
              setDiscoverMessage(fallback.message || "");
              setFetchingUrl(null);
              return;
            }
            if (fallback.mode === "product" && fallback.deviceId) {
              await handleSelectDevice(fallback.deviceId);
              setFetchingUrl(null);
              return;
            }
            alert("Failed: " + (smart.error || `HTTP ${res.status}`));
            setFetchingUrl(null);
            return;
          }
          if (smart.mode === "expand") {
            setScrapedLinks((smart.items || []) as DiscoveredLink[]);
            setListFilter("");
            setDiscoverMessage(smart.message || `Found ${(smart.items || []).length} models`);
            setFetchingUrl(null);
            return;
          }
          if (smart.mode === "product" && smart.deviceId) {
            const ok = await handleSelectDevice(smart.deviceId);
            if (ok) setDiscoverMessage(smart.message || `Imported ${smart.model_name}`);
            setFetchingUrl(null);
            return;
          }
          alert("Failed: unexpected response from import API");
          setFetchingUrl(null);
          return;
        } catch (e: any) {
          alert("Failed: " + (e?.message || "Network error"));
          setFetchingUrl(null);
          return;
        }
      }

      const result = await autoFetchAndSaveMasterDevice(q);
      if (result.success && result.deviceId) {
        await handleSelectDevice(result.deviceId);
      } else {
        alert("Failed to auto-fetch device: " + (result.error || "Unknown error"));
      }
      setFetchingUrl(null);
    };

    const handleBulkScrape = async () => {
      if (!searchQuery.startsWith("http://") && !searchQuery.startsWith("https://")) return;
      setIsBulkScraping(true);
      setDiscoverMessage("");
      const result = await bulkScrapeCategoryLinks(searchQuery);
      if (result.success && result.items) {
        setScrapedLinks(result.items as DiscoveredLink[]);
        setListFilter("");
        setDiscoverMessage(result.message || `Found ${result.items.length} models`);
      } else {
        alert("Failed to scan page: " + (result.error || "Unknown error"));
      }
      setIsBulkScraping(false);
    };

    const handleImportAll = async () => {
      const toImport = listFilter.trim() ? filteredScrapedLinks : scrapedLinks;
      if (toImport.length === 0) return;
      const scope = listFilter.trim()
        ? `${toImport.length} filtered`
        : `all ${toImport.length}`;
      if (
        !confirm(
          `Import ${scope} model(s) into Master Catalog? This may take a minute.`
        )
      )
        return;
      setIsImportingAll(true);
      setImportProgress(`Importing 0/${toImport.length}...`);
      const result = await bulkImportDiscoveredLinks(toImport);
      setImportProgress(result.message || "Done");
      setIsImportingAll(false);
      alert(result.message);
      // Refresh catalog search if query is short text
      if (searchQuery && !searchQuery.startsWith("http")) {
        const results = await manualProvider.searchDevices(searchQuery);
        setSearchResults(results);
      }
    };
  
    const handleVariantConfigChange = (variantId: string, field: string, value: string | boolean) => {
      setVariantsConfig(prev => ({
        ...prev,
        [variantId]: {
          ...prev[variantId],
          [field]: value
        }
      }));
    };
  
    const handleSubmitCatalogProduct = async () => {
      if (!selectedDevice) return;
      setFormError(null);

      const activeVariantsList = Object.entries(variantsConfig).filter(
        ([_, conf]) => conf.active
      );

      if (activeVariantsList.length === 0) {
        setFormError("Select at least one variant to list.");
        return;
      }

      for (const [, conf] of activeVariantsList) {
        const price = parseFloat(conf.price);
        const mrp = parseFloat(conf.mrp);
        if (!Number.isFinite(price) || price <= 0) {
          setFormError(
            "Every active variant needs a selling price greater than 0. Fill Selling Price, then try again."
          );
          return;
        }
        if (Number.isFinite(mrp) && mrp > 0 && price > mrp) {
          setFormError("Selling price cannot be higher than MRP on any variant.");
          return;
        }
      }

      if (!categoryId) {
        setFormError("Pick a store category before publishing.");
        return;
      }
      if (!productName.trim()) {
        setFormError("Product name is required.");
        return;
      }

      setSaving(true);
      try {
        const result = await publishCatalogProduct({
          masterDeviceId: selectedDevice.id,
          productType: productType as
            | "new_mobile"
            | "used_mobile"
            | "accessory"
            | "part",
          categoryId,
          taxRate: parseFloat(taxRate) || 18,
          productName: productName.trim() || undefined,
          shortDescription: shortDescription || undefined,
          variants: activeVariantsList.map(([vId, conf]) => ({
            masterVariantId: vId,
            mrp: parseFloat(conf.mrp) || 0,
            sellingPrice: parseFloat(conf.price) || 0,
            stock: parseInt(conf.stock, 10) || 0,
          })),
        });

        if (!result?.success) {
          const msg = result?.error || "Failed to publish product";
          setFormError(msg);
          return;
        }
        router.push("/admin/products");
      } catch (e: any) {
        console.error("Publish failed", e);
        setFormError(
          e?.message ||
            "Publish failed unexpectedly. Check the browser console / terminal."
        );
      } finally {
        setSaving(false);
      }
    };
  
    const isUrl = searchQuery.startsWith('http://') || searchQuery.startsWith('https://');

    return (
      <div className="p-6 max-w-4xl mx-auto">
        <div className="flex items-center gap-4 mb-6">
          <Link href="/admin/products" className="p-2 bg-gray-100 rounded-full hover:bg-gray-200 transition-colors">
            <ArrowLeft size={20} />
          </Link>
          <div>
            <h1 className="text-2xl font-bold">Add Product</h1>
            <p className="text-gray-500 text-sm">List a new product using the Master Catalog</p>
          </div>
        </div>
  
        {mode === "search" && (
          <div className="space-y-6">
            <div className="flex gap-4">
              <Button onClick={() => setMode("search")} className="flex-1 bg-black text-white">Search Master Catalog</Button>
              <Button onClick={() => { setMode("manual"); setFormError(null); }} variant="outline" className="flex-1">Create Manually</Button>
            </div>
  
            <div className="bg-white p-6 rounded-xl border shadow-sm">
              <div className="relative">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
                <input 
                  type="text" 
                  placeholder="Search mobile name, brand, or paste website link..." 
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-12 pr-4 py-4 text-lg border border-gray-300 rounded-xl focus:ring-2 focus:ring-black outline-none text-[#1d1d1f] placeholder:text-[#6e6e73] bg-white"
                />
              </div>
  
              {isSearching && <div className="p-8 text-center text-gray-500">Searching master catalog...</div>}
              
              {!searchQuery && (
                <div className="mt-8 space-y-6">
                  <div>
                    <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">Mobile Brands (Tap to paste)</h3>
                    <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-3">
                      {[
                        { name: "Apple", url: "https://www.apple.com/in/iphone/" },
                        { name: "Inspire (Apple)", url: "https://inspireonline.in/" },
                        { name: "Samsung", url: "https://www.samsung.com/in/smartphones/all-smartphones/" },
                        { name: "OnePlus", url: "https://www.oneplus.in/" },
                        { name: "Google Pixel", url: "https://store.google.com/in/category/phones?hl=en-IN&pli=1" },
                        { name: "Nothing", url: "https://in.nothing.tech/collections/phones" },
                        { name: "Vivo", url: "https://www.vivo.com/in/products" },
                        { name: "Oppo", url: "https://www.oppo.com/in/smartphones/" },
                        { name: "Xiaomi", url: "https://www.mi.com/in/" },
                        { name: "Poco", url: "https://www.poco.in/" },
                        { name: "Realme", url: "https://www.realme.com/in/" },
                        { name: "iQOO", url: "https://www.iqoo.com/" },
                        { name: "Motorola", url: "https://www.motorola.in/" },
                        { name: "Infinix", url: "https://infinixmobiles.in/" },
                        { name: "Tecno", url: "https://www.tecno-mobile.com/home/" },
                        { name: "Lava", url: "https://lavamobiles.com/" },
                        { name: "HMD (Nokia)", url: "https://www.hmd.com/en_in" },
                        { name: "AI Plus", url: "https://aiplusstore.com/" },
                      ].map(brand => (
                        <div 
                          key={brand.name}
                          onClick={() => setSearchQuery(brand.url)}
                          className="p-2 border rounded-lg cursor-pointer hover:border-black hover:bg-gray-50 transition-colors flex flex-col justify-center text-center"
                        >
                          <span className="font-medium text-xs text-gray-900">{brand.name}</span>
                          <span className="text-[9px] text-gray-400 truncate mt-0.5">{new URL(brand.url).hostname.replace('www.', '')}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div>
                    <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">Accessories & Storage</h3>
                    <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-3">
                      {[
                        { name: "boAt", url: "https://www.boat-lifestyle.com/" },
                        { name: "Spigen", url: "https://spigen.in/" },
                        { name: "Portronics", url: "https://www.portronics.com/collections/mobile-accessories" },
                        { name: "Ambrane", url: "https://ambraneindia.com/" },
                        { name: "Nu Republic", url: "https://www.nurepublic.co/" },
                        { name: "Zebronics", url: "https://zebronics.com/" },
                        { name: "SanDisk", url: "https://www.sandisk.com/en-in" },
                        { name: "Urbn", url: "https://urbnworld.com/collections/power-banks" },
                        { name: "Boult", url: "https://goboult.co.in/" },
                      ].map(brand => (
                        <div 
                          key={brand.name}
                          onClick={() => setSearchQuery(brand.url)}
                          className="p-2 border rounded-lg cursor-pointer hover:border-black hover:bg-gray-50 transition-colors flex flex-col justify-center text-center"
                        >
                          <span className="font-medium text-xs text-gray-900">{brand.name}</span>
                          <span className="text-[9px] text-gray-400 truncate mt-0.5">{new URL(brand.url).hostname.replace('www.', '')}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              <div className="mt-4 space-y-2">
                {searchResults.map(device => {
                  const imageUrl = device.main_image_url || device.variants?.[0]?.reference_image_url || (device.specifications as any)?.main_image_url;
                  return (
                    <div key={device.id} onClick={() => handleSelectDevice(device.id)} className="flex items-center gap-4 p-4 border rounded-lg hover:border-black cursor-pointer transition-all">
                      <div className="w-16 h-16 bg-gray-100 rounded-md flex items-center justify-center overflow-hidden">
                        {imageUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={imageUrl} alt="Phone" className="w-full h-full object-contain mix-blend-multiply" />
                        ) : (
                          <span className="text-xs text-gray-400">Image</span>
                        )}
                      </div>
                      <div>
                        <h3 className="font-semibold text-lg">{device.brand?.name} {device.model_name}</h3>
                        <p className="text-sm text-gray-500">Released: {device.release_year} • {device.variants?.length || 0} variants</p>
                      </div>
                      <Button variant="outline" size="sm" className="ml-auto">Select Device</Button>
                    </div>
                  );
                })}

                {scrapedLinks.length > 0 && (
                   <div className="mt-6">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3">
                        <div>
                          <h3 className="font-bold text-[#1d1d1f]">
                            Discovered Models ({filteredScrapedLinks.length}
                            {listFilter.trim()
                              ? ` of ${scrapedLinks.length}`
                              : ""}
                            )
                          </h3>
                          {discoverMessage && (
                            <p className="text-xs text-[#6e6e73] mt-0.5">{discoverMessage}</p>
                          )}
                          {importProgress && (
                            <p className="text-xs text-blue-600 mt-0.5">{importProgress}</p>
                          )}
                        </div>
                        <Button
                          size="sm"
                          onClick={handleImportAll}
                          disabled={
                            isImportingAll ||
                            fetchingUrl !== null ||
                            filteredScrapedLinks.length === 0
                          }
                          className="bg-[#0B5cff] text-white hover:bg-[#004BBF]"
                        >
                          {isImportingAll
                            ? "Importing all..."
                            : listFilter.trim()
                              ? `Scrape & Add ${filteredScrapedLinks.length} Shown`
                              : "Scrape & Add All Models"}
                        </Button>
                      </div>

                      <div className="relative mb-3">
                        <Search
                          className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
                          size={16}
                        />
                        <input
                          type="search"
                          value={listFilter}
                          onChange={(e) => setListFilter(e.target.value)}
                          placeholder="Filter models (e.g. Fold, A27, Flip)..."
                          className="w-full pl-9 pr-3 py-2.5 text-sm bg-white border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-black/10 focus:border-black"
                        />
                      </div>

                      <div className="space-y-2 max-h-[28rem] overflow-y-auto pr-2 border rounded-xl p-2 bg-gray-50">
                         {filteredScrapedLinks.length === 0 ? (
                           <p className="text-sm text-[#6e6e73] text-center py-8">
                             No models match “{listFilter.trim()}”
                           </p>
                         ) : (
                           filteredScrapedLinks.map((link, idx) => (
                            <div
                              key={`${link.url}-${idx}`}
                              className="flex items-center justify-between gap-3 p-3 bg-white border rounded-lg hover:shadow-sm"
                            >
                               <div className="flex items-center gap-3 min-w-0 flex-1">
                                  <div className="w-14 h-14 sm:w-16 sm:h-16 shrink-0 rounded-lg bg-neutral-100 border border-neutral-200 flex items-center justify-center overflow-hidden">
                                    {link.image ? (
                                      // eslint-disable-next-line @next/next/no-img-element
                                      <img
                                        src={link.image}
                                        alt={link.name}
                                        loading="lazy"
                                        referrerPolicy="no-referrer"
                                        className="w-full h-full object-contain p-1"
                                        onError={(e) => {
                                          (e.currentTarget as HTMLImageElement).style.display =
                                            "none";
                                          const fallback =
                                            e.currentTarget.nextElementSibling as HTMLElement | null;
                                          if (fallback) fallback.classList.remove("hidden");
                                        }}
                                      />
                                    ) : null}
                                    <span
                                      className={`text-neutral-400 flex flex-col items-center gap-0.5 ${
                                        link.image ? "hidden" : ""
                                      }`}
                                    >
                                      <ImageOff size={16} />
                                      <span className="text-[9px]">No img</span>
                                    </span>
                                  </div>
                                  <div className="min-w-0">
                                    <p className="font-semibold text-sm text-[#1d1d1f] leading-snug">
                                      {link.name}
                                    </p>
                                    <p className="text-xs text-blue-600 truncate max-w-[200px] sm:max-w-[380px]">
                                      {link.url}
                                    </p>
                                  </div>
                               </div>
                               <Button
                                 size="sm"
                                 onClick={() => handleAutoFetch(link.url)}
                                 disabled={fetchingUrl !== null || isImportingAll}
                                 className="bg-black text-white hover:bg-gray-800 shrink-0"
                               >
                                  {fetchingUrl === link.url ? "Scraping..." : "Scrape & Add"}
                                </Button>
                            </div>
                           ))
                         )}
                      </div>
                   </div>
                )}
                
                {!isSearching && searchQuery.length > 2 && searchResults.length === 0 && scrapedLinks.length === 0 && (
                  <div className="p-8 text-center bg-gray-50 rounded-xl border border-dashed mt-4 flex flex-col items-center">
                    <p className="text-gray-500 mb-2 font-medium">Device not found in your internal Master Catalog.</p>
                    {isUrl && (
                      <p className="text-xs text-[#6e6e73] mb-4 max-w-md">
                        Tip: Paste a brand hub like{" "}
                        <span className="font-mono">samsung.com/in</span>,{" "}
                        <span className="font-mono">apple.com/in/iphone</span>, or{" "}
                        <span className="font-mono">ambraneindia.com</span> — Smart Scrape lists models, then use Scrape &amp; Add.
                      </p>
                    )}
                    <div className="flex flex-wrap justify-center gap-3">
                        <Button 
                          onClick={() => handleAutoFetch()} 
                          disabled={fetchingUrl !== null}
                          className="bg-[#0B5cff] text-white hover:bg-[#004BBF] transition-colors flex items-center gap-2"
                        >
                          {fetchingUrl === searchQuery
                            ? "Working..."
                            : isUrl
                              ? "Smart Scrape (auto-detect category)"
                              : "Auto-Fetch Specs (Single Device)"}
                        </Button>
                        {isUrl && (
                           <Button 
                              onClick={handleBulkScrape} 
                              disabled={isBulkScraping}
                              variant="outline"
                              className="border-[#0B5cff] text-[#0B5cff] hover:bg-blue-50 transition-colors flex items-center gap-2"
                            >
                              {isBulkScraping ? "Scanning lineup..." : "Scan for all models on page"}
                            </Button>
                        )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

      {mode === "configure" && selectedDevice && (
        <div className="space-y-6">
          <div className="flex items-center justify-between gap-3">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                setMode("search");
                setFormError(null);
              }}
            >
              ← Back to search
            </Button>
          </div>

          {formError && (
            <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {formError}
            </div>
          )}

          <div className="bg-white p-6 rounded-xl border shadow-sm flex gap-6 items-start">
            <div className="w-24 h-32 bg-gray-100 rounded-lg flex-shrink-0 flex items-center justify-center overflow-hidden">
              {selectedDevice.main_image_url || selectedDevice.specifications?.main_image_url || selectedDevice.variants?.[0]?.reference_image_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={
                    (selectedDevice as any).main_image_url ||
                    selectedDevice.specifications?.main_image_url ||
                    selectedDevice.variants?.[0]?.reference_image_url
                  }
                  alt="Phone"
                  className="w-full h-full object-contain mix-blend-multiply"
                />
              ) : (
                <span className="text-xs text-gray-400">No Image</span>
              )}
            </div>
            <div>
              <div className="flex items-center gap-2 mb-2">
                <div className="inline-block px-2 py-1 bg-green-100 text-green-700 text-xs font-bold rounded-md">Master Catalog Verified</div>
                {selectedDevice.source_provider && (
                  <div className={`inline-block px-2 py-1 text-xs font-bold rounded-md ${selectedDevice.source_provider === 'mobileapi.dev' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-700'}`}>
                    Source: {selectedDevice.source_provider}
                  </div>
                )}
              </div>
              <h2 className="text-2xl font-bold text-[#1d1d1f]">
                {productName ||
                  formatStoreProductName(
                    selectedDevice.model_name,
                    selectedDevice.brand?.name
                  )}
              </h2>
              <p className="text-gray-500 mt-1">Release Year: {selectedDevice.release_year}</p>
              {Number(selectedDevice.specifications?.mrp) > 0 ? (
                <p className="text-sm mt-2 font-medium text-[#1d1d1f]">
                  From{" "}
                  <span className="text-[#0B5cff]">
                    ₹{Number(selectedDevice.specifications.mrp).toLocaleString("en-IN")}
                  </span>
                  <span className="text-[#6e6e73] font-normal ml-2">
                    · variant-wise MRP prefilled · stock default 4
                    {String(selectedDevice.specifications?.price_source || "").includes("apple")
                      ? " · Apple IN matrix"
                      : ""}
                  </span>
                </p>
              ) : (
                <p className="text-xs text-[#6e6e73] mt-2">
                  Default stock set to 4. Enter MRP manually if price was not found.
                </p>
              )}
              {Object.keys(selectedDevice.specifications?.color_images || {}).length > 0 && (
                <div className="flex gap-2 mt-3 flex-wrap">
                  {Object.entries(selectedDevice.specifications.color_images as Record<string, string>).map(
                    ([color, url]) => (
                      <div key={color} className="text-center" title={color}>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={url}
                          alt={color}
                          className="w-10 h-12 object-contain bg-gray-50 rounded border"
                        />
                        <p className="text-[10px] text-[#6e6e73] mt-0.5 max-w-[48px] truncate">{color}</p>
                      </div>
                    )
                  )}
                </div>
              )}
            </div>
          </div>

          <div className="bg-white p-6 rounded-xl border shadow-sm">
            <h3 className="text-lg font-semibold mb-4 border-b pb-2">Store Configuration</h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Storefront product name *
                </label>
                <input
                  type="text"
                  value={productName}
                  onChange={(e) => {
                    const next = e.target.value;
                    setProductName(next);
                    if (!shortDescription || shortDescription === productName) {
                      setShortDescription(next);
                    }
                  }}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-black text-[#1d1d1f] bg-white font-medium"
                  placeholder="e.g. iQOO Neo 10R"
                  required
                />
                <p className="text-xs text-[#6e6e73] mt-1">
                  Underscores and double brand names are cleaned automatically — edit freely before publishing.
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Product Condition/Type</label>
                <select 
                  value={productType} 
                  onChange={(e) => setProductType(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-black text-[#1d1d1f] bg-white"
                >
                  <option value="new_mobile">New Mobile (Box Pack)</option>
                  <option value="used_mobile">Used / Pre-Owned</option>
                  <option value="accessory">Accessory (Earbuds, Cases, Chargers, etc.)</option>
                  <option value="part">Spare Part</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Store Category *</label>
                <select 
                  value={categoryId} 
                  onChange={(e) => setCategoryId(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-black text-[#1d1d1f] bg-white"
                >
                  <option value="">Select Category</option>
                  {categories.map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">GST / tax %</label>
                <input
                  type="number"
                  min="0"
                  max="28"
                  step="0.01"
                  value={taxRate}
                  onChange={(e) => setTaxRate(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-black text-[#1d1d1f] bg-white"
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Short description
                </label>
                <textarea
                  value={shortDescription}
                  onChange={(e) => setShortDescription(e.target.value)}
                  rows={2}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-black text-[#1d1d1f] bg-white resize-none text-sm"
                  placeholder="Shown on storefront cards"
                />
              </div>
            </div>

            <h4 className="font-medium text-gray-700 mb-3">Select Variants to List</h4>
            {(!selectedDevice.variants || selectedDevice.variants.length === 0) && (
              <p className="text-sm text-amber-700 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2 mb-4">
                This master device has no variants. Re-scrape it, or create the product manually.
              </p>
            )}
            <div className="space-y-4">
              {selectedDevice.variants?.map(v => (
                <div key={v.id} className={`p-4 border rounded-xl transition-all ${variantsConfig[v.id]?.active ? 'border-black bg-gray-50/50' : 'border-gray-200'}`}>
                  <label className="flex items-center gap-3 cursor-pointer mb-3">
                    <input 
                      type="checkbox" 
                      checked={variantsConfig[v.id]?.active || false}
                      onChange={(e) => handleVariantConfigChange(v.id, "active", e.target.checked)}
                      className="w-5 h-5 rounded border-gray-300 text-black focus:ring-black"
                    />
                    {v.reference_image_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={v.reference_image_url}
                        alt={v.color || "variant"}
                        className="w-12 h-14 object-contain bg-white rounded border flex-shrink-0"
                      />
                    ) : null}
                    <div className="min-w-0">
                      <span className="font-semibold text-lg text-gray-900 block">
                        {v.color || "Standard"} · {v.storage}
                      </span>
                      <span className="text-gray-500 text-sm">{v.ram ? `${v.ram} RAM` : ""}</span>
                    </div>
                    {variantsConfig[v.id]?.mrp ? (
                      <span className="text-sm font-medium text-[#0B5cff] ml-auto">
                        ₹{Number(variantsConfig[v.id].mrp).toLocaleString("en-IN")}
                      </span>
                    ) : (
                      <span className="text-gray-400 text-sm ml-auto">No MRP</span>
                    )}
                  </label>
                  
                  {variantsConfig[v.id]?.active && (
                    <div className="grid grid-cols-3 gap-4 mt-4 pl-8">
                      <Input 
                        label="MRP (₹)" 
                        type="number" 
                        value={variantsConfig[v.id].mrp} 
                        onChange={(e) => handleVariantConfigChange(v.id, "mrp", e.target.value)} 
                      />
                      <Input 
                        label="Selling Price (₹)" 
                        type="number" 
                        value={variantsConfig[v.id].price} 
                        onChange={(e) => handleVariantConfigChange(v.id, "price", e.target.value)} 
                        required
                      />
                      <Input 
                        label="Initial Stock" 
                        type="number" 
                        value={variantsConfig[v.id].stock} 
                        onChange={(e) => handleVariantConfigChange(v.id, "stock", e.target.value)} 
                        required
                      />
                    </div>
                  )}
                </div>
              ))}
            </div>
            
            <div className="mt-8 flex flex-col items-end gap-3">
              {formError && (
                <div className="w-full rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                  {formError}
                </div>
              )}
              <Button
                type="button"
                onClick={handleSubmitCatalogProduct}
                disabled={saving}
                className="flex items-center gap-2"
              >
                {saving ? "Publishing..." : <><Save size={18} /> Publish to Store</>}
              </Button>
              {saving && (
                <p className="text-xs text-[#6e6e73]">
                  Uploading images to Cloudflare R2 — this can take 10–30 seconds…
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {mode === "manual" && (
        <ManualProductForm
          categories={categories}
          brands={brands}
          onBack={() => setMode("search")}
          onSuccess={() => router.push("/admin/products")}
        />
      )}

    </div>
  );
}
