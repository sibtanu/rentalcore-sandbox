import { revalidatePath } from "next/cache";
import { supabase } from "@/lib/supabase";
import { getInventoryData } from "@/lib/inventory";

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
   CREATE STOCK
========================= */
async function createStock(formData: FormData) {
  "use server";

  const itemId = String(formData.get("item_id"));
  const total = Number(formData.get("total_quantity"));
  const out = Number(formData.get("out_of_service_quantity") || 0);
  if (!itemId || Number.isNaN(total)) return;

  await supabase.from("inventory_stock").insert({
    item_id: itemId,
    location_id: "22222222-2222-2222-2222-222222222222",
    total_quantity: total,
    out_of_service_quantity: out,
    tenant_id: "11111111-1111-1111-1111-111111111111",
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

  // swap orders
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
    <main className="p-6 bg-blue-200">
      <h1>Inventory List</h1>

      <form action={createGroup} style={{ marginBottom: 24 }}>
        <input name="name" placeholder="New group name" required />
        <button type="submit" style={{ marginLeft: 8 }}>
          Add Group
        </button>
      </form>

      {inventoryGroups.map((group) => (
        <div key={group.id} style={{ marginBottom: 40 }}>
          <h2 style={{ fontSize: 20, fontWeight: "bold" }}>{group.name}</h2>

          <form action={createItem} style={{ margin: "12px 0" }}>
            <input type="hidden" name="group_id" value={group.id} />
            <input name="name" placeholder="New item name" required />
            <label style={{ marginLeft: 8 }}>
              <input type="checkbox" name="is_serialized" /> Serialized
            </label>
            <button type="submit" style={{ marginLeft: 8 }}>
              Add Item
            </button>
          </form>

          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ borderBottom: "1px solid #ccc" }}>
                <th style={{ textAlign: "left" }}>Item</th>
                <th style={{ textAlign: "center" }}>Order</th>
                <th style={{ textAlign: "right" }}>Available / Total</th>
              </tr>
            </thead>
            <tbody>
              {group.items.map((item) => (
                <tr key={item.id} style={{ borderBottom: "1px solid #eee" }}>
                  <td>{item.name}</td>

                  <td style={{ textAlign: "center" }}>
                    <form action={moveItem} style={{ display: "inline" }}>
                      <input type="hidden" name="item_id" value={item.id} />
                      <input type="hidden" name="direction" value="up" />
                      <button type="submit">↑</button>
                    </form>
                    <form
                      action={moveItem}
                      style={{ display: "inline", marginLeft: 4 }}
                    >
                      <input type="hidden" name="item_id" value={item.id} />
                      <input type="hidden" name="direction" value="down" />
                      <button type="submit">↓</button>
                    </form>
                  </td>

                  <td style={{ textAlign: "right" }}>
                    {item.available} / {item.total}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ))}
    </main>
  );
}
