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
   UPDATE ITEM
========================= */
async function updateItem(formData: FormData) {
  "use server";

  const itemId = String(formData.get("item_id"));
  const name = String(formData.get("name") || "").trim();
  const price = Number(formData.get("price"));

  if (!name || price < 0 || Number.isNaN(price)) return;

  await supabase
    .from("inventory_items")
    .update({ name, price })
    .eq("id", itemId);

  revalidatePath("/");
}

/* =========================
   UPDATE STOCK
========================= */
async function updateStock(formData: FormData) {
  "use server";

  const itemId = String(formData.get("item_id"));
  const totalQuantity = Number(formData.get("total_quantity"));
  const outOfServiceQuantity = Number(formData.get("out_of_service_quantity"));

  if (
    Number.isNaN(totalQuantity) ||
    Number.isNaN(outOfServiceQuantity) ||
    totalQuantity < 0 ||
    outOfServiceQuantity < 0 ||
    outOfServiceQuantity > totalQuantity
  ) {
    return;
  }

  // Check if stock record exists
  const { data: existingStock } = await supabase
    .from("inventory_stock")
    .select("id")
    .eq("item_id", itemId)
    .limit(1)
    .single();

  if (existingStock) {
    // Update existing stock
    await supabase
      .from("inventory_stock")
      .update({
        total_quantity: totalQuantity,
        out_of_service_quantity: outOfServiceQuantity,
      })
      .eq("item_id", itemId);
  } else {
    // Create new stock record
    await supabase.from("inventory_stock").insert({
      item_id: itemId,
      location_id: "22222222-2222-2222-2222-222222222222", // Main Warehouse
      total_quantity: totalQuantity,
      out_of_service_quantity: outOfServiceQuantity,
      tenant_id: "11111111-1111-1111-1111-111111111111",
    });
  }

  revalidatePath("/");
}

/* =========================
   ADD MAINTENANCE LOG
========================= */
async function addMaintenanceLog(formData: FormData) {
  "use server";

  const itemId = String(formData.get("item_id"));
  const note = String(formData.get("note") || "").trim();

  if (!note) return;

  await supabase.from("inventory_maintenance_logs").insert({
    item_id: itemId,
    tenant_id: "11111111-1111-1111-1111-111111111111",
    note,
  });

  revalidatePath("/");
}

/* =========================
   UPDATE UNIT STATUS
========================= */
async function updateUnitStatus(formData: FormData) {
  "use server";

  const unitId = String(formData.get("unit_id"));
  const newStatus = String(formData.get("status"));

  if (!unitId || !newStatus) return;

  // Validate status
  if (!["available", "out", "maintenance"].includes(newStatus)) return;

  await supabase
    .from("inventory_units")
    .update({ status: newStatus })
    .eq("id", unitId);

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
            updateItem={updateItem}
            updateStock={updateStock}
            addMaintenanceLog={addMaintenanceLog}
            updateUnitStatus={updateUnitStatus}
          />
        ))}
      </div>
    </main>
  );
}
