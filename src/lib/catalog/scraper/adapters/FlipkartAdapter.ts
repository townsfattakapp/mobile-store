import * as cheerio from 'cheerio';
import { MasterDevice } from "../../CatalogProvider";
import { ScraperAdapter } from "../ScraperEngine";
import { extractIndianPrice } from "../extractPrice";

export class FlipkartAdapter implements ScraperAdapter {
  match(url: string): boolean {
    return url.includes('flipkart.com');
  }

  async scrape(url: string, html: string): Promise<Partial<MasterDevice> | null> {
    const $ = cheerio.load(html);

    const title = $('.B_NuCI').text().trim() || $('.VU-ZEz').text().trim();
    if (!title) {
      console.warn("Flipkart Scraper: Title not found. Layout might have changed.");
      return null;
    }

    const brandName = title.split(' ')[0];

    let ram = "8GB";
    let storage = "128GB";
    let color = "Black";

    const titleSpecsMatch = title.match(/\(([^,]+),\s*([^)]+)\)/);
    if (titleSpecsMatch) {
      color = titleSpecsMatch[1].trim();
      storage = titleSpecsMatch[2].trim();
    }

    const mainImageUrl = $('img._396cs4').attr('src') || $('img._2r_T1I').attr('src') || $('img.v2Vcxj').attr('src');
    const highlights = $('._2418kt ul li').map((_, el) => $(el).text()).get().join(' | ');
    const { mrp, sellingPrice } = extractIndianPrice($, html);

    return {
      brand_id: "",
      brand_name: brandName,
      model_name: title.replace(brandName, '').split('(')[0].trim(),
      slug: title.split('(')[0].trim().toLowerCase().replace(/[^a-z0-9]+/g, '-'),
      release_year: new Date().getFullYear(),
      source_provider: 'scraper_flipkart',
      specifications: {
        processor: "Unknown",
        display: "Unknown",
        camera: "Unknown",
        battery: "Unknown",
        os: "Unknown",
        dimensions: "Unknown",
        weight: "Unknown",
        description: highlights || "Flipkart scraped data",
        mrp: mrp ?? undefined,
        selling_price: sellingPrice ?? mrp ?? undefined,
        currency: "INR",
      },
      main_image_url: mainImageUrl || "",
      variants: [
        { id: "", master_device_id: "", ram, storage, color, reference_image_url: mainImageUrl || "" }
      ]
    };
  }
}
