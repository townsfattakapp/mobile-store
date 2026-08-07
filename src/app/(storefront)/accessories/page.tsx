import React from "react";
import { createClient } from "@/utils/supabase/server";
import { ProductCard } from "@/components/storefront/ProductCard";

export const revalidate = 60; // Revalidate every 60 seconds

export default async function AccessoriesPage() {
  const supabase = await createClient();
  
  const { data: products } = await supabase
    .from('products')
    .select(`
      *,
      brand:brands(name),
      master_devices(specifications),
      variants:product_variants(*)
    `)
    .eq('type', 'accessory')
    .eq('status', 'active');

  return (
    <div className="min-h-screen bg-white">
      {/* Immersive Header Section */}
      <div className="relative pt-32 pb-24 px-6 overflow-hidden flex flex-col items-center justify-center text-center">
        {/* Subtle Background Glows */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-gradient-to-b from-[#f5f5f7] to-white rounded-[100%] pointer-events-none opacity-80 blur-3xl"></div>
        <div className="absolute top-20 left-1/4 w-[300px] h-[300px] bg-purple-100/50 rounded-full pointer-events-none blur-3xl mix-blend-multiply"></div>
        
        <div className="relative z-10 max-w-4xl mx-auto">
          <h1 className="text-6xl md:text-[84px] font-semibold tracking-tighter text-[#1d1d1f] leading-[1.05] mb-6">
            Accessories. <br className="hidden md:block" />
            <span className="text-[#6e6e73]">Essentials for your essentials.</span>
          </h1>
          <p className="text-xl md:text-2xl text-[#424245] font-medium tracking-tight">
            Cases, chargers, audio, and more.
          </p>
        </div>
      </div>

      {/* Sticky Minimalist Filter Bar Placeholder */}
      <div className="sticky top-[52px] z-30 w-full bg-white/80 backdrop-blur-md border-b border-gray-100 py-4 mb-12">
        <div className="max-w-[1440px] mx-auto px-6 flex items-center justify-between">
          <div className="flex items-center gap-6 text-sm font-medium text-[#6e6e73]">
            <span className="text-[#1d1d1f] font-semibold">All Categories</span>
            <span className="hover:text-[#1d1d1f] cursor-pointer transition-colors">Audio</span>
            <span className="hover:text-[#1d1d1f] cursor-pointer transition-colors">Power</span>
            <span className="hover:text-[#1d1d1f] cursor-pointer transition-colors">Cases</span>
          </div>
          <div className="text-sm font-medium text-[#6e6e73] hover:text-[#1d1d1f] cursor-pointer transition-colors flex items-center gap-1">
            Sort by Featured
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6"/></svg>
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
            <h3 className="text-2xl font-semibold text-[#1d1d1f] mb-2">No accessories available</h3>
            <p className="text-[#6e6e73] text-lg">Check back soon for our latest arrivals.</p>
          </div>
        )}
      </div>
    </div>
  );
}
