import type { InventoryGroup } from "@/lib/inventory";

interface InventoryGroupCardProps {
  group: InventoryGroup;
  createItem: (formData: FormData) => Promise<void>;
  moveItem: (formData: FormData) => Promise<void>;
}

export default function InventoryGroupCard({
  group,
  createItem,
  moveItem,
}: InventoryGroupCardProps) {
  return (
    <div className="mb-10 bg-white rounded-lg shadow-sm border border-gray-200 p-6">
      <h2 className="text-xl font-bold text-gray-900 mb-4">{group.name}</h2>

      <form action={createItem} className="mb-4 p-3 bg-gray-50 rounded-md">
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
                      <input type="hidden" name="item_id" value={item.id} />
                      <input type="hidden" name="direction" value="up" />
                      <button
                        type="submit"
                        className="px-2 py-1 bg-white border border-gray-300 hover:bg-gray-100 hover:border-gray-400 rounded text-sm transition-colors font-semibold text-gray-700 shadow-sm"
                      >
                        ↑
                      </button>
                    </form>
                    <form action={moveItem} className="inline">
                      <input type="hidden" name="item_id" value={item.id} />
                      <input type="hidden" name="direction" value="down" />
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
  );
}
