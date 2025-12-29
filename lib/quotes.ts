import { supabase } from "./supabase";

export interface Quote {
  id: string;
  name: string;
  start_date: string;
  end_date: string;
  status: "draft" | "sent" | "accepted" | "rejected";
  created_at: string;
}

export interface QuoteItem {
  id: string;
  quote_id: string;
  item_id: string;
  quantity: number;
  unit_price_snapshot: number;
  // Joined data
  item_name?: string;
  item_price?: number;
}

export interface QuoteWithItems extends Quote {
  items: QuoteItem[];
}

export interface ItemAvailability {
  available: number;
  total: number;
}

export async function getQuotes(): Promise<Quote[]> {
  const tenantId = "11111111-1111-1111-1111-111111111111";

  const { data: quotes, error } = await supabase
    .from("quotes")
    .select("id, name, start_date, end_date, status, created_at")
    .eq("tenant_id", tenantId)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Error fetching quotes:", error);
    return [];
  }

  return quotes || [];
}

export async function getQuoteWithItems(
  quoteId: string,
): Promise<QuoteWithItems | null> {
  if (!quoteId) {
    return null;
  }

  const tenantId = "11111111-1111-1111-1111-111111111111";

  // Fetch quote
  const { data: quote, error: quoteError } = await supabase
    .from("quotes")
    .select("id, name, start_date, end_date, status, created_at")
    .eq("id", quoteId)
    .eq("tenant_id", tenantId)
    .single();

  if (quoteError) {
    // PGRST116 is "not found" error, which is fine - quote doesn't exist
    // 22P02 is "invalid input syntax for type uuid" - also means quote doesn't exist or invalid ID
    // Only log actual errors, not "not found" or invalid UUID errors
    if (
      quoteError.code &&
      quoteError.code !== "PGRST116" &&
      quoteError.code !== "22P02"
    ) {
      console.error("Error fetching quote:", quoteError);
    }
    return null;
  }

  if (!quote) {
    return null;
  }

  // Fetch quote items with item details
  const { data: quoteItems, error: itemsError } = await supabase
    .from("quote_items")
    .select(
      `
      id,
      quote_id,
      item_id,
      quantity,
      unit_price_snapshot,
      inventory_items:item_id (
        name,
        price,
        is_serialized
      )
    `,
    )
    .eq("quote_id", quoteId)
    .order("created_at", { ascending: true });

  if (itemsError) {
    console.error("Error fetching quote items:", itemsError);
    return { ...quote, items: [] };
  }

  const items: QuoteItem[] =
    quoteItems?.map((qi: any) => ({
      id: qi.id,
      quote_id: qi.quote_id,
      item_id: qi.item_id,
      quantity: qi.quantity,
      unit_price_snapshot: qi.unit_price_snapshot,
      item_name: qi.inventory_items?.name,
      item_price: qi.inventory_items?.price,
    })) || [];

  return { ...quote, items };
}

export async function getItemAvailability(
  itemId: string,
): Promise<ItemAvailability> {
  const tenantId = "11111111-1111-1111-1111-111111111111";

  // First, check if item is serialized
  const { data: item, error: itemError } = await supabase
    .from("inventory_items")
    .select("is_serialized")
    .eq("id", itemId)
    .eq("tenant_id", tenantId)
    .single();

  if (itemError || !item) {
    return { available: 0, total: 0 };
  }

  if (item.is_serialized) {
    // For serialized items, count units
    const { data: units, error: unitsError } = await supabase
      .from("inventory_units")
      .select("status")
      .eq("item_id", itemId);

    if (unitsError || !units) {
      return { available: 0, total: 0 };
    }

    const total = units.length;
    const available = units.filter((u) => u.status === "available").length;

    return { available, total };
  } else {
    // For non-serialized items, check stock
    const { data: stock, error: stockError } = await supabase
      .from("inventory_stock")
      .select("total_quantity, out_of_service_quantity")
      .eq("item_id", itemId)
      .single();

    if (stockError || !stock) {
      return { available: 0, total: 0 };
    }

    const total = stock.total_quantity;
    const available =
      stock.total_quantity - (stock.out_of_service_quantity || 0);

    return { available, total };
  }
}
