"use client";

import React, { useEffect, useState, use } from "react";
import { createClient } from "@/utils/supabase/client";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { ArrowLeft, Save, Plus, Trash2, ShieldAlert } from "lucide-react";
import Link from "next/link";

type CategoryOption = { id: string; name: string; active: boolean };

export default function EditProductPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const supabase = createClient();
  const [activeTab, setActiveTab] = useState("basic");
  
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [saveOk, setSaveOk] = useState(false);
  const [product, setProduct] = useState<any>(null);
  const [variants, setVariants] = useState<any[]>([]);
  const [inspection, setInspection] = useState<any>({});
  const [categories, setCategories] = useState<CategoryOption[]>([]);
  
  useEffect(() => {
    fetchProductData();
  }, [id]);

  const fetchProductData = async () => {
    setLoading(true);
    const [{ data: pData }, { data: catData }] = await Promise.all([
      supabase.from("products").select("*, master_devices(model_name)").eq("id", id).single(),
      supabase
        .from("categories")
        .select("id, name, active")
        .order("name", { ascending: true }),
    ]);

    setCategories(catData || []);

    if (pData) {
      setProduct(pData);
      
      const { data: vData } = await supabase.from("product_variants").select("*").eq("product_id", id);
      if (vData) setVariants(vData);

      if (pData.type === 'used_mobile') {
        const { data: iData } = await supabase.from("used_device_inspections").select("*").eq("product_id", id).single();
        if (iData) setInspection(iData);
      }
    }
    setLoading(false);
  };

  const handleProductChange = (e: any) => {
    const { name, value } = e.target;
    setProduct((prev: any) => ({ ...prev, [name]: value }));
  };

  const handleAddOffer = () => {
    setProduct((prev: any) => {
      const currentSpecs = prev.specifications || {};
      const currentOffers = currentSpecs.offers || [];
      return {
        ...prev,
        specifications: { ...currentSpecs, offers: [...currentOffers, ""] }
      };
    });
  };

  const handleOfferChange = (index: number, value: string) => {
    setProduct((prev: any) => {
      const currentSpecs = prev.specifications || {};
      const currentOffers = [...(currentSpecs.offers || [])];
      currentOffers[index] = value;
      return {
        ...prev,
        specifications: { ...currentSpecs, offers: currentOffers }
      };
    });
  };

  const handleRemoveOffer = (index: number) => {
    setProduct((prev: any) => {
      const currentSpecs = prev.specifications || {};
      const currentOffers = [...(currentSpecs.offers || [])];
      currentOffers.splice(index, 1);
      return {
        ...prev,
        specifications: { ...currentSpecs, offers: currentOffers }
      };
    });
  };

  const handleInspectionChange = (e: any) => {
    const { name, checked } = e.target;
    setInspection((prev: any) => ({ ...prev, [name]: checked }));
  };

  const handleSave = async () => {
    setSaving(true);
    setSaveError("");
    setSaveOk(false);
    
    // Save Product
    // Filter out any empty offers before saving
    let finalSpecs = product.specifications || {};
    if (finalSpecs.offers) {
      finalSpecs.offers = finalSpecs.offers.filter((o: string) => o.trim() !== "");
    }

    const { error: pErr } = await supabase.from("products").update({
      mrp: product.mrp,
      selling_price: product.selling_price,
      stock_quantity: product.stock_quantity,
      status: product.status,
      short_description: product.short_description,
      category_id: product.category_id || null,
      specifications: finalSpecs,
      updated_at: new Date().toISOString(),
    }).eq("id", id);

    // Save Variants
    for (const v of variants) {
      await supabase.from("product_variants").update({
        mrp: v.mrp,
        selling_price: v.selling_price,
        stock_quantity: v.stock_quantity,
        name: v.name
      }).eq("id", v.id);
    }

    // Save Inspection if used mobile
    if (product?.type === 'used_mobile') {
      const { data: existingInspection } = await supabase.from("used_device_inspections").select("product_id").eq("product_id", id).maybeSingle();
      
      if (existingInspection) {
        await supabase.from("used_device_inspections").update(inspection).eq("product_id", id);
      } else {
        await supabase.from("used_device_inspections").insert([{ ...inspection, product_id: id }]);
      }
    }

    setSaving(false);
    if (pErr) setSaveError(pErr.message);
    else setSaveOk(true);
  };

  if (loading) return <div className="p-8">Loading product...</div>;
  if (!product) return <div className="p-8">Product not found.</div>;

  return (
    <div className="p-6 max-w-5xl mx-auto pb-24">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <Link href="/admin/products" className="p-2 bg-gray-100 rounded-full hover:bg-gray-200 transition-colors">
            <ArrowLeft size={20} />
          </Link>
          <div>
            <h1 className="text-2xl font-bold">Edit Product</h1>
            <p className="text-gray-500 text-sm">{product.name} ({product.type})</p>
          </div>
        </div>
        <Button onClick={handleSave} disabled={saving} className="flex items-center gap-2">
          {saving ? "Saving..." : <><Save size={18} /> Save Changes</>}
        </Button>
      </div>

      <div className="flex gap-4 border-b mb-6">
        <button onClick={() => setActiveTab("basic")} className={`pb-2 px-1 border-b-2 font-medium ${activeTab === "basic" ? "border-black text-black" : "border-transparent text-gray-500"}`}>Basic Info</button>
        <button onClick={() => setActiveTab("variants")} className={`pb-2 px-1 border-b-2 font-medium ${activeTab === "variants" ? "border-black text-black" : "border-transparent text-gray-500"}`}>Variants ({variants.length})</button>
        {product.type === 'used_mobile' && (
          <button onClick={() => setActiveTab("inspection")} className={`pb-2 px-1 border-b-2 font-medium ${activeTab === "inspection" ? "border-black text-black" : "border-transparent text-gray-500"}`}>Used Mobile Inspection</button>
        )}
      </div>

      {activeTab === "basic" && (
        <div className="bg-white p-6 rounded-xl border shadow-sm space-y-6">
          <h2 className="text-lg font-semibold">Pricing & Inventory (Base Product)</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Input label="MRP (₹)" name="mrp" type="number" value={product.mrp} onChange={handleProductChange} />
            <Input label="Selling Price (₹)" name="selling_price" type="number" value={product.selling_price} onChange={handleProductChange} />
            <Input label="Total Stock" name="stock_quantity" type="number" value={product.stock_quantity} onChange={handleProductChange} />
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
             <div>
               <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
               <select name="status" value={product.status} onChange={handleProductChange} className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-black text-[#1d1d1f] bg-white">
                 <option value="draft">Draft (Hidden)</option>
                 <option value="active">Active (Visible)</option>
                 <option value="archived">Archived</option>
               </select>
             </div>
             <div>
               <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
               <select
                 name="category_id"
                 value={product.category_id || ""}
                 onChange={handleProductChange}
                 className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-black text-[#1d1d1f] bg-white"
               >
                 <option value="">Uncategorized</option>
                 {categories.map((cat) => (
                   <option key={cat.id} value={cat.id} disabled={!cat.active && product.category_id !== cat.id}>
                     {cat.name}{!cat.active ? " (inactive)" : ""}
                   </option>
                 ))}
               </select>
               <p className="mt-1 text-xs text-gray-500">
                 Manage list in{" "}
                 <Link href="/admin/categories" className="underline underline-offset-2">
                   Categories
                 </Link>
                 .
               </p>
             </div>
          </div>

          {saveError ? (
            <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{saveError}</p>
          ) : null}
          {saveOk ? (
            <p className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
              Product saved.
            </p>
          ) : null}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
            <textarea name="short_description" rows={4} value={product.short_description || ""} onChange={handleProductChange} className="w-full px-4 py-2 border border-gray-300 rounded-lg resize-none text-[#1d1d1f] bg-white placeholder:text-[#6e6e73]" />
          </div>

          <div className="pt-6 border-t mt-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-lg font-semibold">Special Offers & Schemes</h3>
                <p className="text-sm text-gray-500">Bank offers, UPI cashback, or free gifts specific to this product.</p>
              </div>
              <Button onClick={handleAddOffer} variant="outline" size="sm" className="flex items-center gap-2">
                <Plus size={16} /> Add Offer
              </Button>
            </div>
            
            <div className="space-y-3">
              {!(product.specifications?.offers?.length > 0) ? (
                <div className="text-sm text-gray-500 italic p-4 bg-gray-50 rounded-lg text-center">No active offers for this product.</div>
              ) : (
                product.specifications.offers.map((offer: string, index: number) => (
                  <div key={index} className="flex gap-2 items-center">
                    <Input 
                      value={offer} 
                      onChange={(e) => handleOfferChange(index, e.target.value)}
                      placeholder="e.g., Flat ₹2000 Instant Discount on HDFC Cards"
                    />
                    <button onClick={() => handleRemoveOffer(index)} className="p-3 text-red-500 hover:bg-red-50 rounded-lg shrink-0 mt-[26px]">
                      <Trash2 size={18} />
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {activeTab === "variants" && (
        <div className="space-y-4">
          {variants.length === 0 ? (
            <div className="bg-white p-8 text-center rounded-xl border border-dashed">
              <p className="text-gray-500">No variants defined. This is a single-variant product.</p>
            </div>
          ) : (
            variants.map((variant, index) => (
              <div key={variant.id} className="bg-white p-6 rounded-xl border shadow-sm flex items-start gap-4">
                <div className="flex-1 space-y-4">
                  <Input label="Variant Name" value={variant.name} onChange={(e) => {
                    const newVars = [...variants]; newVars[index].name = e.target.value; setVariants(newVars);
                  }} />
                  <div className="grid grid-cols-3 gap-4">
                    <Input label="MRP (₹)" type="number" value={variant.mrp} onChange={(e) => {
                      const newVars = [...variants]; newVars[index].mrp = e.target.value; setVariants(newVars);
                    }} />
                    <Input label="Selling Price (₹)" type="number" value={variant.selling_price} onChange={(e) => {
                      const newVars = [...variants]; newVars[index].selling_price = e.target.value; setVariants(newVars);
                    }} />
                    <Input label="Stock" type="number" value={variant.stock_quantity} onChange={(e) => {
                      const newVars = [...variants]; newVars[index].stock_quantity = e.target.value; setVariants(newVars);
                    }} />
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {activeTab === "inspection" && product.type === 'used_mobile' && (
        <div className="bg-white p-6 rounded-xl border shadow-sm">
          <div className="flex items-center gap-3 mb-6 bg-blue-50 p-4 rounded-lg border border-blue-100">
            <ShieldAlert className="text-blue-600" />
            <div>
              <h3 className="font-semibold text-blue-900">20-Point Quality Inspection</h3>
              <p className="text-sm text-blue-700">Check off the hardware tests that this device has successfully passed. This calculates the Quality Badge on the storefront.</p>
            </div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-4">
            {[
              { id: 'display_tested', label: 'Display (No dead pixels/lines)' },
              { id: 'touch_tested', label: 'Touch Screen (All zones working)' },
              { id: 'camera_tested', label: 'Front & Rear Cameras' },
              { id: 'speaker_tested', label: 'Speakers & Earpiece' },
              { id: 'microphone_tested', label: 'Microphone' },
              { id: 'wifi_tested', label: 'Wi-Fi Connectivity' },
              { id: 'bluetooth_tested', label: 'Bluetooth Connectivity' },
              { id: 'charging_tested', label: 'Charging Port' },
              { id: 'battery_tested', label: 'Battery Health check' },
              { id: 'fingerprint_tested', label: 'Fingerprint Scanner' },
              { id: 'face_id_tested', label: 'Face ID / Face Unlock' },
              { id: 'sim_tested', label: 'SIM Card Reader' },
              { id: 'buttons_tested', label: 'Power & Volume Buttons' },
            ].map(test => (
              <label key={test.id} className="flex items-center gap-3 p-3 border rounded-lg cursor-pointer hover:bg-gray-50 transition-colors">
                <input 
                  type="checkbox" 
                  name={test.id} 
                  checked={inspection[test.id] || false} 
                  onChange={handleInspectionChange}
                  className="w-5 h-5 rounded text-black focus:ring-black"
                />
                <span className="font-medium">{test.label}</span>
              </label>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
