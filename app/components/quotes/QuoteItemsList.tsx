"use client";

import { useState } from "react";
import type { QuoteItem } from "@/lib/quotes";

interface QuoteItemsListProps {
  items: QuoteItem[];
  numberOfDays: number;
  onUpdateItem: (quoteItemId: string, quantity: number) => Promise<void>;
  onDeleteItem: (quoteItemId: string) => Promise<void>;
}

export default function QuoteItemsList({
  items,
  numberOfDays,
  onUpdateItem,
  onDeleteItem,
}: QuoteItemsListProps) {
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [editQuantity, setEditQuantity] = useState("");

  const handleStartEdit = (item: QuoteItem) => {
    setEditingItemId(item.id);
    setEditQuantity(item.quantity.toString());
  };

  const handleCancelEdit = () => {
    setEditingItemId(null);
    setEditQuantity("");
  };

  const handleSave = async (itemId: string) => {
    const quantity = parseInt(editQuantity, 10);
    if (!Number.isNaN(quantity) && quantity > 0) {
      await onUpdateItem(itemId, quantity);
      setEditingItemId(null);
      setEditQuantity("");
    } else {
      handleCancelEdit();
    }
  };

  if (items.length === 0) {
    return (
      <div className="text-center text-gray-500 py-8 text-sm">
        No items yet. Click "+ Add Item" to get started.
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {items.map((item) => {
        const lineTotal =
          item.quantity * item.unit_price_snapshot * numberOfDays;
        const isEditing = editingItemId === item.id;

        return (
          <div
            key={item.id}
            className="p-4 bg-gray-50 rounded-lg border border-gray-200 hover:border-gray-300 transition-colors"
          >
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-2">
                  {/* Drag handle placeholder (for future drag-and-drop) */}
                  <div className="opacity-0 group-hover:opacity-100 cursor-grab">
                    <svg
                      className="w-4 h-4 text-gray-400"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M4 8h16M4 16h16"
                      />
                    </svg>
                  </div>
                  <h5 className="font-medium text-gray-900">
                    {item.item_name || "Unknown Item"}
                  </h5>
                </div>
                <div className="flex items-center gap-4 text-sm text-gray-600">
                  {isEditing ? (
                    <div className="flex items-center gap-2">
                      <span>Quantity:</span>
                      <input
                        type="number"
                        min="1"
                        value={editQuantity}
                        onChange={(e) => setEditQuantity(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            handleSave(item.id);
                          } else if (e.key === "Escape") {
                            handleCancelEdit();
                          }
                        }}
                        onBlur={() => handleSave(item.id)}
                        autoFocus
                        className="w-20 px-2 py-1 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  ) : (
                    <>
                      <span
                        onClick={() => handleStartEdit(item)}
                        className="cursor-pointer hover:text-blue-600 transition-colors"
                      >
                        Qty: {item.quantity}
                      </span>
                      <span>× ${item.unit_price_snapshot.toFixed(2)}</span>
                      <span>
                        × {numberOfDays} day{numberOfDays !== 1 ? "s" : ""}
                      </span>
                    </>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-4">
                <div className="text-right">
                  <div className="text-sm font-semibold text-gray-900">
                    ${lineTotal.toFixed(2)}
                  </div>
                  <div className="text-xs text-gray-500">Line total</div>
                </div>
                {!isEditing && (
                  <button
                    onClick={() => onDeleteItem(item.id)}
                    className="p-1 text-red-600 hover:text-red-700 hover:bg-red-50 rounded transition-colors"
                  >
                    <svg
                      className="w-5 h-5"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                      />
                    </svg>
                  </button>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
