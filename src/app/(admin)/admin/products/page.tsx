import { Suspense } from "react";
import ProductsClient from "./ProductsClient";

export default function ProductsPage() {
  return (
    <Suspense
      fallback={
        <div className="p-8 text-center text-sm text-[#6e6e73]">Loading products…</div>
      }
    >
      <ProductsClient />
    </Suspense>
  );
}
