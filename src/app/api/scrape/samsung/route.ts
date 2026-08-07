import { NextRequest, NextResponse } from "next/server";
import { ScraperEngine } from "@/lib/catalog/scraper/ScraperEngine";
import { fetchSamsungSmartphoneCatalog } from "@/lib/catalog/scraper/samsung";
import { isCategoryUrl, isLikelyProductUrl } from "@/lib/catalog/scraper/CategoryScraper";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * Debug / ops endpoint to verify Samsung scrape from the Next.js runtime.
 * GET /api/scrape/samsung?url=...
 */
export async function GET(req: NextRequest) {
  const url = req.nextUrl.searchParams.get("url") || "";
  if (!url) {
    return NextResponse.json({ error: "Pass ?url=" }, { status: 400 });
  }

  try {
    const meta = {
      isCategory: isCategoryUrl(url),
      isLikelyProduct: isLikelyProductUrl(url),
    };

    if (meta.isCategory || /all-smartphones/i.test(url) || /samsung\.com\/in\/?$/i.test(url)) {
      const items = await fetchSamsungSmartphoneCatalog(url);
      return NextResponse.json({
        mode: "catalog",
        meta,
        count: items.length,
        sample: items.slice(0, 5),
      });
    }

    const engine = new ScraperEngine();
    const t0 = Date.now();
    const device = await engine.fetchFromUrl(url);
    return NextResponse.json({
      mode: "product",
      meta,
      ms: Date.now() - t0,
      ok: !!(device && device.model_name),
      model_name: device?.model_name || null,
      variants: device?.variants?.length || 0,
      source: (device as any)?.source_provider || null,
      mrp: (device?.specifications as any)?.mrp ?? null,
      price_source: (device?.specifications as any)?.price_source || null,
      error: device ? null : "scrape returned null",
    });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: e?.message || String(e), stack: e?.stack },
      { status: 500 }
    );
  }
}
