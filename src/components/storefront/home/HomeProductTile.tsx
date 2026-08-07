import Link from "next/link";
import {
  brandLabel,
  cleanProductName,
  discountAmount,
  discountPercent,
  formatINR,
} from "@/lib/storefront/format";
import { ProductImage } from "@/components/storefront/ProductImage";

export type HomeProduct = {
  id: string;
  name: string;
  slug: string;
  selling_price: number;
  mrp?: number | null;
  main_image_url?: string | null;
  type?: string;
  brand?: { name: string } | { name: string }[] | null;
  variants?: { name: string | null }[] | null;
};

type Props = {
  product: HomeProduct;
  priority?: boolean;
  tone?: "light" | "warm";
};

export function HomeProductTile({ product, priority = false, tone = "light" }: Props) {
  const name = cleanProductName(product.name);
  const brand = brandLabel(product.brand);
  const price = Number(product.selling_price || 0);
  const mrp = Number(product.mrp || 0);
  const save = discountAmount(mrp, price);
  const pct = discountPercent(mrp, price);
  const variant = product.variants?.[0]?.name || null;
  const isUsed = product.type === "used_mobile";

  return (
    <article className={`ms-tile ms-tile--${tone}`}>
      <Link href={`/product/${product.slug}`} className="ms-tile-link group">
        <div className="ms-tile-media">
          {(pct > 0 || isUsed) && (
            <div className="ms-tile-badges">
              {isUsed && <span className="ms-badge ms-badge--ink">Pre-owned</span>}
              {pct > 0 && <span className="ms-badge ms-badge--accent">Save {pct}%</span>}
            </div>
          )}
          <ProductImage
            src={product.main_image_url}
            alt={name}
            priority={priority}
            width={480}
            height={560}
            sizes="(max-width: 768px) 70vw, 280px"
            className="ms-tile-img"
          />
        </div>
        <div className="ms-tile-body">
          {brand && <p className="ms-meta">{brand}</p>}
          <h3 className="ms-tile-title">{name}</h3>
          {variant && <p className="ms-tile-spec">{variant}</p>}
          <div className="ms-price-row">
            <span className="ms-price">{formatINR(price)}</span>
            {mrp > price && <span className="ms-mrp">{formatINR(mrp)}</span>}
          </div>
          {save > 0 && <p className="ms-save">You save {formatINR(save)}</p>}
          <span className="ms-tile-cta">View details</span>
        </div>
      </Link>
    </article>
  );
}
