import { MasterDevice } from "../CatalogProvider";

/**
 * AutoFetchProvider
 * 
 * Uses the commercial MobileAPI.dev API to fetch real, granular device specifications.
 */
export const autoFetchProvider = {
  async fetchFromExternalWebAPI(query: string): Promise<Partial<MasterDevice> | null> {
    try {
      // 1. Fetch from MobileAPI.dev
      const apiKey = process.env.MOBILEAPI_DEV_KEY || "";
      const response = await fetch(`https://api.mobileapi.dev/devices/search?name=${encodeURIComponent(query)}`, {
        headers: {
            "Authorization": `Bearer ${apiKey}`,
            "Accept": "application/json"
        }
      });
      
      let phone = null;
      console.log(`AutoFetchProvider: search response.ok=${response.ok} status=${response.status}`);
      if (response.ok) {
        const json = await response.json();
        console.log(`AutoFetchProvider: found ${json.devices?.length} devices for query "${query}"`);
        // mobileapi.dev returns { devices: [ ... ] }
        if (json.devices && json.devices.length > 0) {
          // mobileapi.dev's fuzzy search is sometimes terrible and returns random phones for queries like 'iphone 17'.
          // Let's make sure the returned phone name or brand at least partially matches the query.
          // 1. Try to find a device whose exact name is fully contained in the query (e.g., query "iPhone 17 Pro 256GB" contains "iPhone 17 Pro")
          // Sort by name length descending so we match "iPhone 17 Pro Max" before "iPhone 17 Pro" before "iPhone 17"
          const sortedDevices = [...json.devices].sort((a: any, b: any) => b.name.length - a.name.length);
          const queryLower = query.toLowerCase();
          let bestMatch = sortedDevices.find((d: any) => queryLower.includes(d.name.toLowerCase()));
          
          // 2. If no exact substring match, score based on how many words match
          if (!bestMatch) {
             const queryParts = queryLower.split(' ').filter(p => p.length > 2); // ignore small words
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
          }
          
          if (bestMatch) {
            phone = bestMatch;
            console.log(`AutoFetchProvider: bestMatch found = ${phone.name}`);
          } else {
            console.log(`AutoFetchProvider: No bestMatch found out of ${json.devices.length} devices.`);
          }
        }
      } else {
          console.error("AutoFetchProvider API Error:", await response.text());
      }

      // 2. Map the rich response if found
      if (phone) {
        // Fetch detailed specs for real variants
        let detailedVariants: any[] = [];
        try {
            const detailRes = await fetch(`https://api.mobileapi.dev/devices/${phone.id}`, {
                headers: { "Authorization": `Bearer ${apiKey}` }
            });
            if (detailRes.ok) {
                const detailJson = await detailRes.json();
                const memoryStr = detailJson.memory?.internal || "";
                const colorsStr = detailJson.misc?.colors || phone.colors || "Black";
                const colors = colorsStr.split(',').map((c: string) => c.trim());
                
                // e.g. memoryStr = "256GB 8GB RAM, 512GB 8GB RAM"
                const memOptions = memoryStr.split(',').map((m: string) => m.trim());
                
                memOptions.forEach((mem: string) => {
                    const parts = mem.split(' ');
                    const storage = parts[0];
                    const ram = parts.length > 1 ? parts.slice(1).join(' ') : "8GB RAM";
                    colors.forEach((color: string) => {
                       detailedVariants.push({
                           id: "", master_device_id: "", ram: ram, storage: storage, color: color
                       });
                    });
                });
            }
        } catch (e) {
            console.error("Error fetching detailed device:", e);
        }

        // Fallback variants if detailed fetch failed
        if (detailedVariants.length === 0) {
            detailedVariants = [
                { id: "", master_device_id: "", ram: phone.hardware?.split(',')[0]?.trim() || "Unknown", storage: phone.storage?.split(',')[0]?.trim() || "128GB", color: phone.colors?.split(',')[0]?.trim() || "Black" },
                { id: "", master_device_id: "", ram: phone.hardware?.split(',')[0]?.trim() || "Unknown", storage: phone.storage?.split(',')[1]?.trim() || "256GB", color: phone.colors?.split(',')[1]?.trim() || "White" }
            ];
        }

        // Extract release year from string (e.g. "Announced 2023, September")
        const releaseYearMatch = phone.release_date?.match(/\b20\d{2}\b/);
        const releaseYear = releaseYearMatch ? parseInt(releaseYearMatch[0]) : new Date().getFullYear();

        return {
          brand_id: "", 
          brand_name: phone.manufacturer_name,
          model_name: phone.name,
          slug: `${phone.manufacturer_name}-${phone.name}`.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
          release_year: releaseYear,
          source_provider: 'mobileapi.dev',
          specifications: {
            processor: phone.hardware || "Unknown",
            display: phone.screen_resolution || "Unknown",
            camera: phone.camera || "Unknown",
            battery: phone.battery_capacity || "Unknown",
            os: "Unknown", 
            dimensions: phone.thickness ? `Thickness: ${phone.thickness}` : "Unknown",
            weight: phone.weight ? (phone.weight.endsWith('g') ? phone.weight : `${phone.weight}g`) : "Unknown",
            description: "" 
          },
          main_image_url: phone.image_url || "",
          variants: detailedVariants
        };
      }

      // 3. FALLBACK: If the API doesn't have the phone, don't break the demo flow
      // BUT if the user pasted a URL and the scraper failed, we should NOT create a fake fallback item named after the URL!
      if (query.startsWith('http://') || query.startsWith('https://')) {
          console.log("AutoFetchProvider: Skipping fallback for URL query.");
          return null;
      }

      const formattedName = query.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
      const fallbackBrand = formattedName.split(' ')[0]; 
      return {
          brand_id: "",
          brand_name: fallbackBrand, 
          model_name: formattedName.substring(fallbackBrand.length).trim() || formattedName, 
          slug: query.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
          release_year: new Date().getFullYear(),
          source_provider: 'auto-fallback',
          specifications: {
            processor: "Latest Flagship Chip",
            display: "OLED Pro Display",
            camera: "Triple Camera Array",
            battery: "All-day Battery"
          },
          main_image_url: "https://placehold.co/400x500/ffffff/0071e3?text=" + encodeURIComponent(formattedName),
          variants: [
            { id: "", master_device_id: "", ram: "8GB", storage: "128GB", color: "Standard Black" },
            { id: "", master_device_id: "", ram: "12GB", storage: "256GB", color: "Premium White" }
          ]
      };

    } catch (error) {
      console.error("AutoFetch API Error:", error);
      return null;
    }
  }
};
