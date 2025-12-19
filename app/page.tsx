import { revalidatePath } from "next/cache";
import { supabase } from "@/lib/supabase";
import { getInventoryData } from "@/lib/inventory";
import InventoryGroupCard from "./components/InventoryGroupCard";

/* =========================
   CREATE GROUP
========================= */
async function createGroup(formData: FormData) {
  "use server";

  const name = String(formData.get("name") || "").trim();
  if (!name) return;

  const { data: max } = await supabase
    .from("inventory_groups")
    .select("display_order")
    .order("display_order", { ascending: false })
    .limit(1)
    .single();

  await supabase.from("inventory_groups").insert({
    name,
    tenant_id: "11111111-1111-1111-1111-111111111111",
    display_order: (max?.display_order ?? 0) + 1,
  });

  revalidatePath("/");
}

/* =========================
   CREATE ITEM
========================= */
async function createItem(formData: FormData) {
  "use server";

  const name = String(formData.get("name") || "").trim();
  const groupId = String(formData.get("group_id"));
  const isSerialized = formData.get("is_serialized") === "on";
  if (!name || !groupId) return;

  const { data: max } = await supabase
    .from("inventory_items")
    .select("display_order")
    .eq("group_id", groupId)
    .order("display_order", { ascending: false })
    .limit(1)
    .single();

  await supabase.from("inventory_items").insert({
    name,
    category: "General",
    price: 0,
    group_id: groupId,
    is_serialized: isSerialized,
    active: true,
    tenant_id: "11111111-1111-1111-1111-111111111111",
    display_order: (max?.display_order ?? 0) + 1,
  });

  revalidatePath("/");
}

/* =========================
   MOVE ITEM (UP / DOWN)
========================= */
async function moveItem(formData: FormData) {
  "use server";

  const itemId = String(formData.get("item_id"));
  const direction = String(formData.get("direction"));

  const { data: current } = await supabase
    .from("inventory_items")
    .select("id, group_id, display_order")
    .eq("id", itemId)
    .single();

  if (!current) return;

  const operator = direction === "up" ? "lt" : "gt";
  const orderByAsc = direction === "up";

  const { data: neighbor } = await supabase
    .from("inventory_items")
    .select("id, display_order")
    .eq("group_id", current.group_id)
    .filter("display_order", operator, current.display_order)
    .order("display_order", { ascending: orderByAsc })
    .limit(1)
    .single();

  if (!neighbor) return;

  await supabase
    .from("inventory_items")
    .update({ display_order: neighbor.display_order })
    .eq("id", current.id);

  await supabase
    .from("inventory_items")
    .update({ display_order: current.display_order })
    .eq("id", neighbor.id);

  revalidatePath("/");
}

/* =========================
   PAGE
========================= */
export default async function Home() {
  const inventoryGroups = await getInventoryData();

  return (
    <main className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-3xl font-bold text-gray-900 mb-6">
          Inventory List
        </h1>

        <form
          action={createGroup}
          className="mb-8 p-4 bg-white rounded-lg shadow-sm border border-gray-200"
        >
          <div className="flex gap-2">
            <input
              name="name"
              placeholder="New group name"
              required
              className="flex-1 px-4 py-2 border rounded"
            />
            <button className="px-4 py-2 bg-blue-600 text-white rounded">
              Add Group
            </button>
          </div>
        </form>

        {inventoryGroups.map((group) => (
          <InventoryGroupCard
            key={group.id}
            group={group}
            createItem={createItem}
            moveItem={moveItem}
          />
        ))}
      </div>
    </main>
  );
}
