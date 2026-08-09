import { MasterDevice } from "../CatalogProvider";

type SpecSection = { title: string; items: { name: string; value: string }[] };

function entriesFromObject(
  obj: Record<string, unknown> | null | undefined,
  labelMap: Record<string, string>
): { name: string; value: string }[] {
  if (!obj || typeof obj !== "object") return [];
  const items: { name: string; value: string }[] = [];
  for (const [key, label] of Object.entries(labelMap)) {
    const raw = obj[key];
    if (raw == null) continue;
    const value = String(raw).replace(/\s+/g, " ").trim();
    if (!value || value === "null" || value === "{}") continue;
    items.push({ name: label, value });
  }
  return items;
}

function buildSpecSections(detail: any): SpecSection[] {
  const sections: SpecSection[] = [];

  const push = (title: string, items: { name: string; value: string }[]) => {
    if (items.length) sections.push({ title, items });
  };

  push(
    "Network",
    entriesFromObject(detail.network, {
      technology: "Technology",
      bands_2g: "2G bands",
      bands_3g: "3G bands",
      bands_4g: "4G bands",
      bands_5g: "5G bands",
      speed: "Speed",
    })
  );
  push(
    "Body",
    entriesFromObject(detail.body, {
      dimensions: "Dimensions",
      weight: "Weight",
      build: "Build",
      sim: "SIM",
      other: "Other",
    })
  );
  push(
    "Display",
    entriesFromObject(detail.display, {
      type: "Type",
      size: "Size",
      resolution: "Resolution",
      protection: "Protection",
      other: "Other",
    })
  );
  push(
    "Platform",
    entriesFromObject(detail.platform, {
      os: "OS",
      chipset: "Chipset",
      cpu: "CPU",
      gpu: "GPU",
    })
  );
  push(
    "Memory",
    entriesFromObject(detail.memory, {
      card_slot: "Card slot",
      internal: "Internal",
      other: "Other",
    })
  );
  push(
    "Main Camera",
    entriesFromObject(detail.main_camera, {
      modules: "Modules",
      features: "Features",
      video: "Video",
    })
  );
  push(
    "Selfie Camera",
    entriesFromObject(detail.selfie_camera, {
      modules: "Modules",
      features: "Features",
      video: "Video",
    })
  );
  push(
    "Sound",
    entriesFromObject(detail.sound, {
      loudspeaker: "Loudspeaker",
      audio_jack: "3.5mm jack",
    })
  );
  push(
    "Comms",
    entriesFromObject(detail.comms, {
      wlan: "WLAN",
      bluetooth: "Bluetooth",
      positioning: "Positioning",
      nfc: "NFC",
      radio: "Radio",
      usb: "USB",
    })
  );
  push(
    "Features",
    entriesFromObject(detail.features, {
      sensors: "Sensors",
      other: "Other",
    })
  );
  push(
    "Battery",
    entriesFromObject(detail.battery, {
      type: "Type",
      charging: "Charging",
    })
  );
  push(
    "Misc",
    entriesFromObject(detail.misc, {
      model_numbers: "Models",
      colors: "Colors",
    })
  );

  return sections;
}

function sectionsToTechSpecs(sections: SpecSection[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (const section of sections) {
    for (const item of section.items) {
      out[`${section.title} · ${item.name}`] = item.value;
    }
  }
  return out;
}

/**
 * AutoFetchProvider
 *
 * Uses MobileAPI.dev (GSMArena-sourced catalog) for real device specifications.
 */
export const autoFetchProvider = {
  async fetchFromExternalWebAPI(
    query: string,
    options?: { allowFallback?: boolean }
  ): Promise<Partial<MasterDevice> | null> {
    const allowFallback = options?.allowFallback !== false;
    try {
      const apiKey = process.env.MOBILEAPI_DEV_KEY || "";
      if (!apiKey) {
        console.warn("AutoFetchProvider: MOBILEAPI_DEV_KEY missing");
        return null;
      }

      const response = await fetch(
        `https://api.mobileapi.dev/devices/search?name=${encodeURIComponent(query)}`,
        {
          headers: {
            Authorization: `Bearer ${apiKey}`,
            Accept: "application/json",
          },
        }
      );

      let phone: any = null;
      console.log(
        `AutoFetchProvider: search response.ok=${response.ok} status=${response.status}`
      );
      if (response.ok) {
        const json = await response.json();
        console.log(
          `AutoFetchProvider: found ${json.devices?.length} devices for query "${query}"`
        );
        if (json.devices && json.devices.length > 0) {
          const sortedDevices = [...json.devices].sort(
            (a: any, b: any) => b.name.length - a.name.length
          );
          const queryLower = query.toLowerCase();
          let bestMatch = sortedDevices.find((d: any) =>
            queryLower.includes(d.name.toLowerCase())
          );

          if (!bestMatch) {
            const queryParts = queryLower.split(" ").filter((p) => p.length > 2);
            let highestScore = 0;
            for (const d of json.devices) {
              const fullName = `${d.manufacturer_name} ${d.name}`.toLowerCase();
              let score = 0;
              for (const part of queryParts) {
                if (fullName.includes(part)) score++;
              }
              if (score > highestScore) {
                highestScore = score;
                bestMatch = d;
              }
            }
            // Require at least 2 meaningful tokens to avoid random phones
            if (highestScore < Math.min(2, queryParts.length)) {
              bestMatch = null;
            }
          }

          if (bestMatch) {
            phone = bestMatch;
            console.log(`AutoFetchProvider: bestMatch found = ${phone.name}`);
          } else {
            console.log(
              `AutoFetchProvider: No bestMatch found out of ${json.devices.length} devices.`
            );
          }
        }
      } else {
        console.error("AutoFetchProvider API Error:", await response.text());
      }

      if (phone) {
        let detail: any = null;
        let detailedVariants: any[] = [];
        try {
          const detailRes = await fetch(
            `https://api.mobileapi.dev/devices/${phone.id}`,
            {
              headers: { Authorization: `Bearer ${apiKey}` },
            }
          );
          if (detailRes.ok) {
            detail = await detailRes.json();
            const memoryStr = detail.memory?.internal || "";
            const colorsStr =
              detail.misc?.colors || phone.colors || "Black";
            const colors = String(colorsStr)
              .split(",")
              .map((c: string) => c.trim())
              .filter(Boolean);

            const memOptions = String(memoryStr)
              .split(",")
              .map((m: string) => m.trim())
              .filter(Boolean);

            memOptions.forEach((mem: string) => {
              const parts = mem.split(/\s+/);
              const storage = parts[0] || "128GB";
              const ram =
                parts.length > 1 ? parts.slice(1).join(" ") : "6GB RAM";
              colors.forEach((color: string) => {
                detailedVariants.push({
                  id: "",
                  master_device_id: "",
                  ram,
                  storage,
                  color,
                });
              });
            });
          }
        } catch (e) {
          console.error("Error fetching detailed device:", e);
        }

        if (detailedVariants.length === 0) {
          detailedVariants = [
            {
              id: "",
              master_device_id: "",
              ram: phone.hardware?.split(",")[0]?.trim() || "Unknown",
              storage: phone.storage?.split(",")[0]?.trim() || "128GB",
              color: phone.colors?.split(",")[0]?.trim() || "Black",
            },
          ];
        }

        const releaseYearMatch = phone.release_date?.match(/\b20\d{2}\b/);
        const releaseYear = releaseYearMatch
          ? parseInt(releaseYearMatch[0])
          : new Date().getFullYear();

        const spec_sections = detail ? buildSpecSections(detail) : [];
        const tech_specs = sectionsToTechSpecs(spec_sections);

        const processor =
          detail?.platform?.chipset || phone.hardware || "Unknown";
        const display =
          [
            detail?.display?.size,
            detail?.display?.type,
            detail?.display?.resolution,
          ]
            .filter(Boolean)
            .join(" · ") ||
          phone.screen_resolution ||
          "Unknown";
        const camera =
          detail?.main_camera?.modules || phone.camera || "Unknown";
        const battery =
          [
            detail?.battery?.type,
            detail?.battery?.charging
              ? String(detail.battery.charging).split(/\n| {2,}/)[0]
              : "",
          ]
            .filter(Boolean)
            .join(" · ") ||
          phone.battery_capacity ||
          "Unknown";
        const os = detail?.platform?.os || "Unknown";
        const dimensions =
          detail?.body?.dimensions ||
          (phone.thickness ? `Thickness: ${phone.thickness}` : "Unknown");
        const weight =
          detail?.body?.weight ||
          (phone.weight
            ? phone.weight.endsWith("g")
              ? phone.weight
              : `${phone.weight}g`
            : "Unknown");

        return {
          brand_id: "",
          brand_name: phone.manufacturer_name,
          model_name: phone.name,
          slug: `${phone.manufacturer_name}-${phone.name}`
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, "-"),
          release_year: releaseYear,
          source_provider: "gsmarena_via_mobileapi",
          specifications: {
            processor,
            display,
            camera,
            battery,
            os,
            dimensions,
            weight,
            description: detail?.description || "",
            spec_sections,
            tech_specs,
            specs_source: "gsmarena_via_mobileapi",
          },
          main_image_url: phone.image_url || "",
          variants: detailedVariants,
        };
      }

      if (query.startsWith("http://") || query.startsWith("https://")) {
        console.log("AutoFetchProvider: Skipping fallback for URL query.");
        return null;
      }

      if (!allowFallback) return null;

      const formattedName = query
        .split(" ")
        .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
        .join(" ");
      const fallbackBrand = formattedName.split(" ")[0];
      return {
        brand_id: "",
        brand_name: fallbackBrand,
        model_name:
          formattedName.substring(fallbackBrand.length).trim() || formattedName,
        slug: query.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
        release_year: new Date().getFullYear(),
        source_provider: "auto-fallback",
        specifications: {
          processor: "Latest Flagship Chip",
          display: "OLED Pro Display",
          camera: "Triple Camera Array",
          battery: "All-day Battery",
        },
        main_image_url:
          "https://placehold.co/400x500/ffffff/0071e3?text=" +
          encodeURIComponent(formattedName),
        variants: [
          {
            id: "",
            master_device_id: "",
            ram: "8GB",
            storage: "128GB",
            color: "Standard Black",
          },
          {
            id: "",
            master_device_id: "",
            ram: "12GB",
            storage: "256GB",
            color: "Premium White",
          },
        ],
      };
    } catch (error) {
      console.error("AutoFetch API Error:", error);
      return null;
    }
  },
};
