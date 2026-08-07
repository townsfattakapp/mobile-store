import * as cheerio from 'cheerio';
import { MasterDevice } from "../../CatalogProvider";
import { ScraperAdapter } from "../ScraperEngine";
import { extractIndianPrice } from "../extractPrice";

export class AmazonAdapter implements ScraperAdapter {
  match(url: string): boolean {
    return url.includes('amazon.in') || url.includes('amazon.com');
  }

  async scrape(url: string, html: string): Promise<Partial<MasterDevice> | null> {
    const $ = cheerio.load(html);

    if ($('title').text().toLowerCase().includes('captcha')) {
      console.warn("Amazon Scraper Blocked by CAPTCHA");
      return null;
    }

    const title = $('#productTitle').text().trim() || $('#title').text().trim();
    if (!title) return null;

    const brandName = title.split(' ')[0];

    let ram = "8GB";
    let storage = "128GB";
    let color = "Black";
    let display = "Unknown";
    let camera = "Unknown";
    let battery = "Unknown";

    $('#productDetails_techSpec_section_1 tr').each((_, el) => {
      const key = $(el).find('th').text().trim().toLowerCase();
      const val = $(el).find('td').text().trim();
      if (key.includes('ram')) ram = val;
      if (key.includes('storage') || key.includes('memory storage')) storage = val;
      if (key.includes('color') || key.includes('colour')) color = val;
    });

    let mainImageUrl = $('#landingImage').attr('src') || $('#imgBlkFront').attr('src');
    if (!mainImageUrl) {
      const scripts = $('script').text();
      const match = scripts.match(/"large":"([^"]+)"/);
      if (match) mainImageUrl = match[1];
    }

    const { mrp, sellingPrice } = extractIndianPrice($, html);

    return {
      brand_id: "",
      brand_name: brandName,
      model_name: title.substring(brandName.length).trim(),
      slug: title.substring(0, 30).toLowerCase().replace(/[^a-z0-9]+/g, '-'),
      release_year: new Date().getFullYear(),
      source_provider: 'scraper_amazon',
      specifications: {
        processor: "Unknown (Amazon parsing limited)",
        display,
        camera,
        battery,
        os: "Unknown",
        dimensions: "Unknown",
        weight: "Unknown",
        description: $('#feature-bullets').text().trim().substring(0, 500),
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
