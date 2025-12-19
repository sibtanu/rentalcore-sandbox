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
              className="flex-1 px-4 py-2 bg-white text-gray-900 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            <button
              type="submit"
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors font-medium"
            >
              Add Group
            </button>
          </div>
        </form>

        {inventoryGroups.map((group) => (
          <div
            key={group.id}
            className="mb-10 bg-white rounded-lg shadow-sm border border-gray-200 p-6"
          >
            <h2 className="text-xl font-bold text-gray-900 mb-4">
              {group.name}
            </h2>

            <form
              action={createItem}
              className="mb-4 p-3 bg-gray-50 rounded-md"
            >
              <div className="flex gap-2 items-center flex-wrap">
                <input type="hidden" name="group_id" value={group.id} />
                <input
                  name="name"
                  placeholder="New item name"
                  required
                  className="flex-1 min-w-[200px] px-3 py-2 bg-white text-gray-900 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
                />
                <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                  <input
                    type="checkbox"
                    name="is_serialized"
                    className="w-4 h-4 text-green-600 rounded focus:ring-green-500"
                  />{" "}
                  Serialized
                </label>
                <button
                  type="submit"
                  className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors font-medium"
                >
                  Add Item
                </button>
              </div>
            </form>

            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="border-b-2 border-gray-300">
                    <th className="text-left py-3 px-4 font-semibold text-gray-700">
                      Item
                    </th>
                    <th className="text-center py-3 px-4 font-semibold text-gray-700">
                      Order
                    </th>
                    <th className="text-right py-3 px-4 font-semibold text-gray-700">
                      Available / Total
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {group.items.map((item) => (
                    <tr
                      key={item.id}
                      className="border-b border-gray-200 hover:bg-gray-50 transition-colors"
                    >
                      <td className="py-3 px-4 text-gray-900 font-medium flex items-center gap-2">
                        {item.name}
                        {item.total === 0 && (
                          <span className="text-xs px-2 py-0.5 bg-yellow-100 text-yellow-800 rounded">
                            Needs stock
                          </span>
                        )}
                      </td>

                      <td className="py-3 px-4 text-center">
                        <div className="flex gap-1 justify-center">
                          <form action={moveItem} className="inline">
                            <input
                              type="hidden"
                              name="item_id"
                              value={item.id}
                            />
                            <input type="hidden" name="direction" value="up" />
                            <button
                              type="submit"
                              className="px-2 py-1 bg-white border border-gray-300 hover:bg-gray-100 hover:border-gray-400 rounded text-sm transition-colors font-semibold text-gray-700 shadow-sm"
                            >
                              ↑
                            </button>
                          </form>
                          <form action={moveItem} className="inline">
                            <input
                              type="hidden"
                              name="item_id"
                              value={item.id}
                            />
                            <input
                              type="hidden"
                              name="direction"
                              value="down"
                            />
                            <button
                              type="submit"
                              className="px-2 py-1 bg-white border border-gray-300 hover:bg-gray-100 hover:border-gray-400 rounded text-sm transition-colors font-semibold text-gray-700 shadow-sm"
                            >
                              ↓
                            </button>
                          </form>
                        </div>
                      </td>

                      <td className="py-3 px-4 text-right text-gray-700 font-mono">
                        {item.available} / {item.total}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ))}
      </div>
    </main>
  );
}
