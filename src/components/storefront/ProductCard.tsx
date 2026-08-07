import React from "react";
import Link from "next/link";
import { ProductImage } from "@/components/storefront/ProductImage";

type ProductCardProps = {
  product: any;
  /** Eager-load for first row / LCP candidates only */
  priority?: boolean;
  /** Prefetch PDP — default true for in-viewport cards via Next Link */
  prefetch?: boolean;
};

export function ProductCard({ product, priority = false, prefetch = true }: ProductCardProps) {
  const image =
    product.main_image_url ||
    "https://placehold.co/400x500/ffffff/a1a1aa?text=No+Image";

  const mrp = product.mrp || 0;
  const price = product.selling_price || 0;
  const discount = mrp > price ? Math.round(((mrp - price) / mrp) * 100) : 0;
  const isUsed = product.type === "used_mobile";
  const href = `/product/${product.slug}`;
  const specs = product.master_devices?.specifications;

  return (
    <article className="group bg-white rounded-[28px] border border-gray-100 hover:shadow-xl hover:border-gray-200 transition-all duration-300 overflow-hidden flex flex-col h-full relative">
      <div className="absolute top-4 left-4 right-4 flex flex-wrap items-center justify-between gap-2 z-20 pointer-events-none">
        <div className="flex gap-2">
          {discount > 0 && (
            <span className="bg-[#e3000f] text-white text-[10px] font-semibold px-2.5 py-1 rounded-full uppercase tracking-wider shadow-sm">
              Save {discount}%
            </span>
          )}
          {isUsed && (
            <span className="bg-[#1d1d1f] text-white text-[10px] font-semibold px-2.5 py-1 rounded-full uppercase tracking-wider shadow-sm">
              Pre-Owned
            </span>
          )}
        </div>
      </div>

      <Link
        href={href}
        prefetch={prefetch}
        className="flex flex-col flex-1 min-h-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3b2f7c] focus-visible:ring-offset-2 rounded-[28px]"
      >
        <div className="relative w-full aspect-[4/5] px-[18px] py-4 bg-[#fbfbfd] overflow-hidden">
          <ProductImage
            src={image}
            alt={product.name}
            priority={priority}
            fill
            smartFit
            sizes="(max-width: 640px) 85vw, (max-width: 1024px) 45vw, 280px"
            className="object-contain object-center !w-full !h-full drop-shadow-lg mix-blend-multiply transition-transform duration-700 ease-out"
          />
        </div>

        <div className="p-6 pt-4 flex flex-col flex-grow items-center text-center z-10 relative bg-white">
          {product.brand?.name && (
            <span className="text-[11px] font-bold text-[#6e6e73] uppercase tracking-widest mb-1">
              {product.brand.name}
            </span>
          )}

          <h3 className="text-[20px] md:text-[22px] font-semibold text-[#1d1d1f] tracking-tight leading-tight mb-2">
            {product.name}
          </h3>

          <div className="mb-auto">
            {specs && (
              <p className="text-xs font-medium text-[#6e6e73] line-clamp-2 px-2">
                {specs.processor || specs.display || "Pro cameras. Pro design."}
              </p>
            )}
          </div>

          <div className="flex flex-col items-center mt-6 mb-4">
            <div className="text-[17px] font-medium text-[#1d1d1f]">
              {Array.isArray(product.variants) && product.variants.length > 0 ? "From " : ""}
              ₹{Number(price).toLocaleString("en-IN")}
            </div>
          </div>

          <span className="bg-[#0071e3] text-white text-sm font-medium px-8 py-2.5 rounded-full shadow-sm w-full sm:w-auto text-center group-hover:bg-[#0077ED] transition-colors duration-200">
            Buy
          </span>
        </div>
      </Link>
    </article>
  );
}
