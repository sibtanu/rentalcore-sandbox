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
  const tenantId = "11111111-1111-1111-1111-111111111111";

  // Fetch quote
  const { data: quote, error: quoteError } = await supabase
    .from("quotes")
    .select("id, name, start_date, end_date, status, created_at")
    .eq("id", quoteId)
    .eq("tenant_id", tenantId)
    .single();

  if (quoteError || !quote) {
    console.error("Error fetching quote:", quoteError);
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
        price
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
