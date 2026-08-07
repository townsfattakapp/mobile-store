import { createClient } from "@/utils/supabase/server";
import { ProductCard } from "@/components/storefront/ProductCard";

export default async function UsedMobilesPage() {
  const supabase = await createClient();
  
  const { data: products } = await supabase
    .from('products')
    .select(`
      *,
      brand:brands(name),
      master_devices(specifications),
      variants:product_variants(*)
    `)
    .eq('type', 'used_mobile')
    .eq('status', 'active');

  return (
    <div className="min-h-screen bg-white">
      {/* Apple-style Typographic Header */}
      <div className="pt-24 pb-16 px-4 text-center max-w-4xl mx-auto">
        <h1 className="text-5xl md:text-[80px] font-semibold tracking-tight text-[#1d1d1f] leading-tight mb-6">
          Certified Pre-Owned. <span className="text-[#6e6e73]">Good for you, and the planet.</span>
        </h1>
      </div>

      <div className="max-w-[1440px] mx-auto px-4 pb-24">
        {products && products.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {products.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        ) : (
          <div className="text-center py-20 text-[#6e6e73] text-xl">
            No pre-owned mobiles currently available. Check back soon.
          </div>
        )}
      </div>
    </div>
  );
}
