"use server";

import { revalidatePath } from "next/cache";
import { supabase } from "@/lib/supabase";

const tenantId = "11111111-1111-1111-1111-111111111111";

export async function createQuote(formData: FormData) {
  const name = String(formData.get("name") || "").trim();
  const startDate = String(formData.get("start_date") || "");
  const endDate = String(formData.get("end_date") || "");

  if (!name || !startDate || !endDate) {
    return { error: "Name, start date, and end date are required" };
  }

  const { error } = await supabase.from("quotes").insert({
    name,
    start_date: startDate,
    end_date: endDate,
    status: "draft",
    tenant_id: tenantId,
  });

  if (error) {
    console.error("[createQuote] Error creating quote:", {
      action: "createQuote",
      name,
      error: error.message,
    });
    return { error: "Failed to create quote" };
  }

  revalidatePath("/quotes");
  return { success: true };
}

export async function updateQuote(formData: FormData) {
  const quoteId = String(formData.get("quote_id"));
  const name = String(formData.get("name") || "").trim();
  const startDate = String(formData.get("start_date") || "");
  const endDate = String(formData.get("end_date") || "");

  if (!quoteId || !name || !startDate || !endDate) {
    return { error: "Quote ID, name, start date, and end date are required" };
  }

  const { error } = await supabase
    .from("quotes")
    .update({
      name,
      start_date: startDate,
      end_date: endDate,
    })
    .eq("id", quoteId)
    .eq("tenant_id", tenantId);

  if (error) {
    console.error("[updateQuote] Error updating quote:", {
      action: "updateQuote",
      quote_id: quoteId,
      error: error.message,
    });
    return { error: "Failed to update quote" };
  }

  revalidatePath("/quotes");
  return { success: true };
}

export async function deleteQuote(formData: FormData) {
  const quoteId = String(formData.get("quote_id"));

  if (!quoteId) {
    return { error: "Quote ID is required" };
  }

  // Delete quote items first (cascade should handle this, but being explicit)
  const { error: itemsError } = await supabase
    .from("quote_items")
    .delete()
    .eq("quote_id", quoteId);

  if (itemsError) {
    console.error("[deleteQuote] Error deleting quote items:", {
      action: "deleteQuote",
      quote_id: quoteId,
      error: itemsError.message,
    });
    return { error: "Failed to delete quote items" };
  }

  // Delete quote
  const { error } = await supabase
    .from("quotes")
    .delete()
    .eq("id", quoteId)
    .eq("tenant_id", tenantId);

  if (error) {
    console.error("[deleteQuote] Error deleting quote:", {
      action: "deleteQuote",
      quote_id: quoteId,
      error: error.message,
    });
    return { error: "Failed to delete quote" };
  }

  revalidatePath("/quotes");
  return { success: true };
}

export async function addQuoteItem(formData: FormData) {
  const quoteId = String(formData.get("quote_id"));
  const itemId = String(formData.get("item_id"));
  const quantity = Number(formData.get("quantity"));

  if (!quoteId || !itemId || !quantity || quantity <= 0) {
    return { error: "Quote ID, item ID, and valid quantity are required" };
  }

  // Fetch item to get current price
  const { data: item, error: itemError } = await supabase
    .from("inventory_items")
    .select("price")
    .eq("id", itemId)
    .eq("tenant_id", tenantId)
    .single();

  if (itemError || !item) {
    console.error("[addQuoteItem] Error fetching item:", {
      action: "addQuoteItem",
      item_id: itemId,
      error: itemError?.message,
    });
    return { error: "Failed to fetch item" };
  }

  // Insert quote item with price snapshot
  const { error } = await supabase.from("quote_items").insert({
    quote_id: quoteId,
    item_id: itemId,
    quantity,
    unit_price_snapshot: item.price,
  });

  if (error) {
    console.error("[addQuoteItem] Error adding quote item:", {
      action: "addQuoteItem",
      quote_id: quoteId,
      item_id: itemId,
      error: error.message,
    });
    return { error: "Failed to add item to quote" };
  }

  revalidatePath("/quotes");
  return { success: true };
}

export async function updateQuoteItem(formData: FormData) {
  const quoteItemId = String(formData.get("quote_item_id"));
  const quantity = Number(formData.get("quantity"));

  if (!quoteItemId || !quantity || quantity <= 0) {
    return { error: "Quote item ID and valid quantity are required" };
  }

  const { error } = await supabase
    .from("quote_items")
    .update({ quantity })
    .eq("id", quoteItemId);

  if (error) {
    console.error("[updateQuoteItem] Error updating quote item:", {
      action: "updateQuoteItem",
      quote_item_id: quoteItemId,
      error: error.message,
    });
    return { error: "Failed to update quote item" };
  }

  revalidatePath("/quotes");
  return { success: true };
}

export async function deleteQuoteItem(formData: FormData) {
  const quoteItemId = String(formData.get("quote_item_id"));

  if (!quoteItemId) {
    return { error: "Quote item ID is required" };
  }

  const { error } = await supabase
    .from("quote_items")
    .delete()
    .eq("id", quoteItemId);

  if (error) {
    console.error("[deleteQuoteItem] Error deleting quote item:", {
      action: "deleteQuoteItem",
      quote_item_id: quoteItemId,
      error: error.message,
    });
    return { error: "Failed to delete quote item" };
  }

  revalidatePath("/quotes");
  return { success: true };
}

export async function searchInventoryItems(query: string) {
  const searchTerm = `%${query.toLowerCase()}%`;

  const { data: items, error } = await supabase
    .from("inventory_items")
    .select("id, name, price")
    .eq("active", true)
    .eq("tenant_id", tenantId)
    .ilike("name", searchTerm)
    .limit(20);

  if (error) {
    console.error("[searchInventoryItems] Error searching items:", {
      action: "searchInventoryItems",
      query,
      error: error.message,
    });
    return [];
  }

  return items || [];
}
