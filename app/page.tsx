import { revalidatePath } from "next/cache";
import { supabase } from "@/lib/supabase";
import { getInventoryData } from "@/lib/inventory";

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

      {inventoryGroups.length === 0 ? (
        <p>No inventory items found.</p>
      ) : (
        inventoryGroups.map((group) => (
          <div key={group.id} style={{ marginBottom: 32 }}>
            <h2 style={{ marginBottom: 16, fontSize: 20, fontWeight: "bold" }}>
              {group.name}
            </h2>

            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ borderBottom: "1px solid #ccc" }}>
                  <th style={{ textAlign: "left", padding: "8px 0" }}>
                    Item Name
                  </th>
                  <th style={{ textAlign: "right", padding: "8px 0" }}>
                    Available / Total
                  </th>
                </tr>
              </thead>
              <tbody>
                {group.items.map((item) => (
                  <tr key={item.id} style={{ borderBottom: "1px solid #eee" }}>
                    <td style={{ padding: "8px 0" }}>{item.name}</td>
                    <td style={{ textAlign: "right", padding: "8px 0" }}>
                      {item.available} / {item.total}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ))
      )}
    </main>
  );
}
