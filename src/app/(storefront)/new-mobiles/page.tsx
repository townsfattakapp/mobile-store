import React from "react";
import Link from "next/link";
import { createClient } from "@/utils/supabase/server";
import { ProductCard } from "@/components/storefront/ProductCard";

export const revalidate = 60; // Revalidate every 60 seconds

export default async function NewMobilesPage({
  searchParams,
}: {
  searchParams: Promise<{ brand?: string; sort?: string; min?: string; max?: string }>;
}) {
  const resolvedParams = await searchParams;
  const brandFilter = resolvedParams.brand;
  const sortFilter = resolvedParams.sort;
  const minPrice = resolvedParams.min ? Number(resolvedParams.min) : null;
  const maxPrice = resolvedParams.max ? Number(resolvedParams.max) : null;

  const supabase = await createClient();
  
  let query = supabase
    .from('products')
    .select(`
      *,
      brand:brands!inner(name),
      master_devices(specifications),
      variants:product_variants(*)
    `)
    .eq('type', 'new_mobile')
    .eq('status', 'active');

  if (brandFilter) {
    query = query.ilike('brands.name', `%${brandFilter}%`);
  }

  if (minPrice != null && !Number.isNaN(minPrice)) {
    query = query.gte('selling_price', minPrice);
  }
  if (maxPrice != null && !Number.isNaN(maxPrice)) {
    query = query.lte('selling_price', maxPrice);
  }

  if (sortFilter === 'price_asc') {
    query = query.order('selling_price', { ascending: true });
  } else if (sortFilter === 'price_desc') {
    query = query.order('selling_price', { ascending: false });
  } else {
    query = query.order('created_at', { ascending: false });
  }

  const { data: products } = await query;

  return (
    <div className="min-h-screen bg-white">
      {/* Immersive Header Section */}
      <div className="relative pt-32 pb-24 px-6 overflow-hidden flex flex-col items-center justify-center text-center">
        {/* Subtle Background Glows */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-gradient-to-b from-[#f5f5f7] to-white rounded-[100%] pointer-events-none opacity-80 blur-3xl"></div>
        <div className="absolute top-20 left-1/4 w-[300px] h-[300px] bg-blue-100/50 rounded-full pointer-events-none blur-3xl mix-blend-multiply"></div>
        
        <div className="relative z-10 max-w-4xl mx-auto">
          <h1 className="text-6xl md:text-[84px] font-semibold tracking-tighter text-[#1d1d1f] leading-[1.05] mb-6">
            Store. <br className="hidden md:block" />
            <span className="text-[#6e6e73]">The best way to buy the products you love.</span>
          </h1>
          <p className="text-xl md:text-2xl text-[#424245] font-medium tracking-tight">
            Latest models. Best prices. Delivered to your door.
          </p>
        </div>
      </div>

      {/* Sticky Minimalist Filter Bar Placeholder */}
      <div className="sticky top-[52px] z-30 w-full bg-white/80 backdrop-blur-md border-b border-gray-100 py-4 mb-12">
        <div className="max-w-[1440px] mx-auto px-6 flex items-center justify-between">
          <div className="flex items-center gap-6 text-sm font-medium text-[#6e6e73]">
            <Link 
              href="/new-mobiles"
              className={`hover:text-[#1d1d1f] transition-colors ${!brandFilter ? 'text-[#1d1d1f] font-semibold' : ''}`}
            >
              All Models
            </Link>
            <Link 
              href="/new-mobiles?brand=apple"
              className={`hover:text-[#1d1d1f] transition-colors ${brandFilter === 'apple' ? 'text-[#1d1d1f] font-semibold' : ''}`}
            >
              Apple
            </Link>
            <Link 
              href="/new-mobiles?brand=samsung"
              className={`hover:text-[#1d1d1f] transition-colors ${brandFilter === 'samsung' ? 'text-[#1d1d1f] font-semibold' : ''}`}
            >
              Samsung
            </Link>
          </div>
          <div className="relative group">
            <div className="text-sm font-medium text-[#6e6e73] hover:text-[#1d1d1f] cursor-pointer transition-colors flex items-center gap-1">
              {sortFilter === 'price_asc' ? 'Price: Low to High' : sortFilter === 'price_desc' ? 'Price: High to Low' : 'Sort by Featured'}
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6"/></svg>
            </div>
            {/* Sort Dropdown */}
            <div className="absolute right-0 top-full mt-2 w-48 bg-white border border-gray-100 rounded-xl shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all">
              <Link href={`/new-mobiles?${brandFilter ? `brand=${brandFilter}` : ''}`} className="block px-4 py-2 text-sm text-[#424245] hover:bg-gray-50 hover:text-black">Featured</Link>
              <Link href={`/new-mobiles?sort=price_asc${brandFilter ? `&brand=${brandFilter}` : ''}`} className="block px-4 py-2 text-sm text-[#424245] hover:bg-gray-50 hover:text-black">Price: Low to High</Link>
              <Link href={`/new-mobiles?sort=price_desc${brandFilter ? `&brand=${brandFilter}` : ''}`} className="block px-4 py-2 text-sm text-[#424245] hover:bg-gray-50 hover:text-black">Price: High to Low</Link>
            </div>
          </div>
        </div>
      </div>

      {/* Product Grid */}
      <div className="max-w-[1440px] mx-auto px-6 pb-32">
        {products && products.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8">
            {products.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        ) : (
          <div className="text-center py-32 flex flex-col items-center justify-center bg-[#f5f5f7] rounded-[40px] mx-4">
            <h3 className="text-2xl font-semibold text-[#1d1d1f] mb-2">No products available</h3>
            <p className="text-[#6e6e73] text-lg">Check back soon for our latest arrivals.</p>
          </div>
        )}
      </div>
    </div>
  );
}
