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

  const { data: max, error: maxErr } = await supabase
    .from("inventory_groups")
    .select("display_order")
    .order("display_order", { ascending: false })
    .limit(1)
    .single();

  if (maxErr) throw new Error(maxErr.message);

  const { error } = await supabase.from("inventory_groups").insert({
    name,
    tenant_id: "11111111-1111-1111-1111-111111111111",
    display_order: (max?.display_order ?? 0) + 1,
  });

  if (error) throw new Error(error.message);

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

  const { data: max, error: maxErr } = await supabase
    .from("inventory_items")
    .select("display_order")
    .eq("group_id", groupId)
    .order("display_order", { ascending: false })
    .limit(1)
    .single();

  if (maxErr) throw new Error(maxErr.message);

  const { error } = await supabase.from("inventory_items").insert({
    name,
    category: "General", // REQUIRED
    price: 0, // REQUIRED
    group_id: groupId,
    is_serialized: isSerialized,
    active: true,
    tenant_id: "11111111-1111-1111-1111-111111111111",
    display_order: (max?.display_order ?? 0) + 1,
  });

  if (error) throw new Error(error.message);

  revalidatePath("/");
}

/* =========================
   CREATE STOCK (NON-SERIALIZED)
========================= */
async function createStock(formData: FormData) {
  "use server";

  const itemId = String(formData.get("item_id"));
  const total = Number(formData.get("total_quantity"));
  const out = Number(formData.get("out_of_service_quantity") || 0);

  if (!itemId || Number.isNaN(total)) return;

  const { error } = await supabase.from("inventory_stock").insert({
    item_id: itemId,
    location_id: "22222222-2222-2222-2222-222222222222",
    total_quantity: total,
    out_of_service_quantity: out,
    tenant_id: "11111111-1111-1111-1111-111111111111",
  });

  if (error) throw new Error(error.message);

  revalidatePath("/");
}

/* =========================
   PAGE
========================= */
export default async function Home() {
  const inventoryGroups = await getInventoryData();

  return (
    <main style={{ padding: 24 }}>
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
                <th style={{ textAlign: "left" }}>Item Name</th>
                <th style={{ textAlign: "right" }}>Available / Total</th>
              </tr>
            </thead>
            <tbody>
              {group.items.map((item) => (
                <tr key={item.id} style={{ borderBottom: "1px solid #eee" }}>
                  <td>
                    {item.name}

                    {item.total === 0 && (
                      <form action={createStock} style={{ marginTop: 6 }}>
                        <input type="hidden" name="item_id" value={item.id} />
                        <input
                          type="number"
                          name="total_quantity"
                          placeholder="Total"
                          required
                        />
                        <input
                          type="number"
                          name="out_of_service_quantity"
                          placeholder="Out"
                          defaultValue={0}
                          style={{ marginLeft: 6 }}
                        />
                        <button type="submit" style={{ marginLeft: 6 }}>
                          Set Stock
                        </button>
                      </form>
                    )}
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
