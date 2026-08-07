import * as cheerio from 'cheerio';
import { MasterDevice } from "../CatalogProvider";
import { ScraperEngine } from "../scraper/ScraperEngine";

/**
 * WebScraperProvider
 * 
 * Attempts to scrape device specifications.
 * If query is a URL (amazon, flipkart, apple), it uses the Multi-Source ScraperEngine.
 * Otherwise, it attempts to search GSMArena.
 */
export const webScraperProvider = {
  async fetchFromExternalWebAPI(query: string): Promise<Partial<MasterDevice> | null> {
    try {
      // 1. If it's a URL, route to the Multi-Source Scraper Engine
      const lowerQuery = query.toLowerCase();
      if (lowerQuery.startsWith('http://') || lowerQuery.startsWith('https://')) {
          const engine = new ScraperEngine();
          return await engine.fetchFromUrl(query);
      }

      // 2. Otherwise, treat as a generic search (GSMArena specific)
      const searchUrl = `https://www.gsmarena.com/res.php3?sSearch=${encodeURIComponent(query)}`;
      
      // WARNING: This fetch will likely fail with 403 unless a proxy service is used.
      // E.g. const response = await fetch(`https://api.zenrows.com/v1/?apikey=YOUR_KEY&url=${encodeURIComponent(searchUrl)}&premium_proxy=true`);
      const response = await fetch(searchUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36'
        }
      });

      if (!response.ok) {
        console.warn(`Scraper blocked or failed. Status: ${response.status}. Requires proxy.`);
        return null; // Fall back gracefully
      }

      const html = await response.text();
      const $ = cheerio.load(html);

      // Extract first search result link (GSMArena specific)
      const firstResultHref = $('.makers ul li a').first().attr('href');
      
      if (!firstResultHref) {
        return null;
      }

      // Fetch the actual device page
      const devicePageUrl = `https://www.gsmarena.com/${firstResultHref}`;
      const deviceRes = await fetch(devicePageUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
      });

      if (!deviceRes.ok) return null;

      const deviceHtml = await deviceRes.text();
      const $$ = cheerio.load(deviceHtml);

      // Extract specs (GSMArena specific selectors)
      const modelName = $$('h1.specs-phone-name-title').text().trim();
      if (!modelName) return null;

      const mainImageUrl = $$('.specs-photo-main a img').attr('src');
      const releaseText = $$('[data-spec="year"]').text().trim(); // E.g., "Released 2023, September"
      const releaseYearMatch = releaseText.match(/\b20\d{2}\b/);
      const releaseYear = releaseYearMatch ? parseInt(releaseYearMatch[0]) : new Date().getFullYear();

      // Extract raw specs
      const os = $$('[data-spec="os"]').text().trim();
      const chipset = $$('[data-spec="chipset"]').text().trim();
      const displaySize = $$('[data-spec="displaysize"]').text().trim();
      const displayRes = $$('[data-spec="displayresolution"]').text().trim();
      const camera = $$('[data-spec="cam1modules"]').text().trim();
      const battery = $$('[data-spec="batdescription1"]').text().trim();
      const weight = $$('[data-spec="weight"]').text().trim();
      const dimensions = $$('[data-spec="dimensions"]').text().trim();
      const internalMemory = $$('[data-spec="internalmemory"]').text().trim(); // e.g., "128GB 6GB RAM, 256GB 8GB RAM"
      
      // Attempt to extract colors
      const colorsText = $$('[data-spec="colors"]').text().trim();
      const colors = colorsText ? colorsText.split(',').map(c => c.trim()) : ["Black"];

      // Brand name usually first word
      const brandName = modelName.split(' ')[0];

      return {
        brand_id: "", 
        brand_name: brandName,
        model_name: modelName.replace(brandName, '').trim(),
        slug: modelName.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
        release_year: releaseYear,
        source_provider: 'web_scraper',
        specifications: {
          processor: chipset || "Unknown",
          display: `${displaySize} ${displayRes}`.trim() || "Unknown",
          camera: camera || "Unknown",
          battery: battery || "Unknown",
          os: os || "Unknown",
          dimensions: dimensions || "Unknown",
          weight: weight || "Unknown",
          description: "Scraped from web"
        },
        main_image_url: mainImageUrl || "",
        variants: [
          // Fallback defaults if parsing fails
          { id: "", master_device_id: "", ram: "8GB", storage: "128GB", color: colors[0] }
        ]
      };
    } catch (e) {
      console.error("Scraper Provider Error:", e);
      return null;
    }
  },

  async fetchListFromUrl(query: string): Promise<{name: string, url: string, image?: string}[]> {
    if (!query.startsWith('http://') && !query.startsWith('https://')) {
       return [];
    }
    // Lazy load CategoryScraper
    const { CategoryScraper } = await import('../scraper/CategoryScraper');
    const scraper = new CategoryScraper();
    return await scraper.fetchCategoryLinks(query);
  }
};
