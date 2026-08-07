"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/utils/supabase/server";

async function requireStaff() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not signed in." as const };

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  if (!profile || (profile.role !== "admin" && profile.role !== "staff")) {
    return { error: "Unauthorized." as const };
  }

  return { error: null, supabase } as const;
}

function slugify(input: string) {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)+/g, "");
}

function revalidateCatalog() {
  revalidatePath("/admin/products");
  revalidatePath("/admin/categories");
  revalidatePath("/new-mobiles");
  revalidatePath("/accessories");
  revalidatePath("/used-mobiles");
  revalidatePath("/parts");
}

export async function createCategoryAction(input: {
  name: string;
  slug?: string;
  description?: string;
}) {
  const auth = await requireStaff();
  if (auth.error) return { error: auth.error };
  const { supabase } = auth;

  const name = input.name.trim();
  if (!name) return { error: "Category name is required." };
  const slug = (input.slug?.trim() || slugify(name));
  if (!slug) return { error: "Slug is required." };

  const { data, error } = await supabase
    .from("categories")
    .insert({
      name,
      slug,
      description: input.description?.trim() || null,
      active: true,
    })
    .select("id, name, slug, description, active")
    .single();

  if (error) return { error: error.message };
  revalidateCatalog();
  return { success: true as const, category: data };
}

export async function updateCategoryAction(input: {
  id: string;
  name: string;
  slug: string;
  description?: string;
  active: boolean;
}) {
  const auth = await requireStaff();
  if (auth.error) return { error: auth.error };
  const { supabase } = auth;

  const name = input.name.trim();
  const slug = input.slug.trim() || slugify(name);
  if (!name || !slug) return { error: "Name and slug are required." };

  const { error } = await supabase
    .from("categories")
    .update({
      name,
      slug,
      description: input.description?.trim() || null,
      active: input.active,
      updated_at: new Date().toISOString(),
    })
    .eq("id", input.id);

  if (error) return { error: error.message };
  revalidateCatalog();
  return { success: true as const };
}

export async function deleteCategoryAction(id: string) {
  const auth = await requireStaff();
  if (auth.error) return { error: auth.error };
  const { supabase } = auth;

  const { count } = await supabase
    .from("products")
    .select("id", { count: "exact", head: true })
    .eq("category_id", id);

  if ((count ?? 0) > 0) {
    return {
      error: `${count} product(s) still use this category. Reassign them first, or deactivate the category instead.`,
    };
  }

  const { error } = await supabase.from("categories").delete().eq("id", id);
  if (error) return { error: error.message };
  revalidateCatalog();
  return { success: true as const };
}

export async function setProductCategoryAction(productId: string, categoryId: string | null) {
  const auth = await requireStaff();
  if (auth.error) return { error: auth.error };
  const { supabase } = auth;

  const { error } = await supabase
    .from("products")
    .update({
      category_id: categoryId,
      updated_at: new Date().toISOString(),
    })
    .eq("id", productId);

  if (error) return { error: error.message };
  revalidatePath(`/admin/products/${productId}`);
  revalidateCatalog();
  return { success: true as const };
}

export async function bulkSetProductCategoryAction(
  productIds: string[],
  categoryId: string | null
) {
  const auth = await requireStaff();
  if (auth.error) return { error: auth.error };
  const { supabase } = auth;

  const ids = [...new Set(productIds.filter(Boolean))];
  if (!ids.length) return { error: "Select at least one product." };

  const { data, error } = await supabase
    .from("products")
    .update({
      category_id: categoryId,
      updated_at: new Date().toISOString(),
    })
    .in("id", ids)
    .select("id");

  if (error) return { error: error.message };
  revalidateCatalog();
  return { success: true as const, updated: data?.length ?? ids.length };
}
