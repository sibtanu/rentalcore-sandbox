"use client";

import { useState, useEffect } from "react";
import type { InventoryGroup, InventoryItem } from "@/lib/inventory";

interface InventoryGroupCardProps {
  group: InventoryGroup;
  createItem: (formData: FormData) => Promise<void>;
  moveItem: (formData: FormData) => Promise<void>;
  updateItem: (formData: FormData) => Promise<void>;
}

export default function InventoryGroupCard({
  group,
  createItem,
  moveItem,
  updateItem,
}: InventoryGroupCardProps) {
  const [selectedItem, setSelectedItem] = useState<InventoryItem | null>(null);
  const [localItem, setLocalItem] = useState<InventoryItem | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [editingField, setEditingField] = useState<"name" | "price" | null>(
    null
  );
  const [isSaving, setIsSaving] = useState(false);
  const [editValue, setEditValue] = useState<string>("");

  useEffect(() => {
    if (selectedItem) {
      setLocalItem(selectedItem);
      // Trigger animation after DOM update
      setTimeout(() => setIsDrawerOpen(true), 10);
    } else {
      setIsDrawerOpen(false);
      setLocalItem(null);
      setEditingField(null);
    }
  }, [selectedItem]);

  const handleStartEdit = (field: "name" | "price") => {
    if (!localItem) return;
    setEditingField(field);
    setEditValue(
      field === "name" ? localItem.name : localItem.price.toString()
    );
  };

  const handleCancelEdit = () => {
    setEditingField(null);
    setEditValue("");
  };

  const handleSave = async () => {
    if (!localItem || !editingField) return;

    const field = editingField;

    // Validation
    if (field === "name" && !editValue.trim()) return;
    if (field === "price") {
      const numValue = Number(editValue);
      if (Number.isNaN(numValue) || numValue < 0) {
        handleCancelEdit();
        return;
      }
    }

    setIsSaving(true);

    // Optimistic update
    const updatedItem = {
      ...localItem,
      [field]: field === "name" ? editValue.trim() : Number(editValue),
    };
    setLocalItem(updatedItem);

    // Save to server
    const formData = new FormData();
    formData.append("item_id", localItem.id);
    formData.append("name", updatedItem.name);
    formData.append("price", updatedItem.price.toString());

    try {
      await updateItem(formData);
      setSelectedItem(updatedItem); // Update selectedItem so it persists
      setEditingField(null);
      setEditValue("");
    } catch (error) {
      // Revert on error
      setLocalItem(selectedItem);
    } finally {
      setIsSaving(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleSave();
    } else if (e.key === "Escape") {
      e.preventDefault();
      handleCancelEdit();
    }
  };

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !editingField) {
        setSelectedItem(null);
      }
    };

    if (selectedItem) {
      document.addEventListener("keydown", handleEscape);
      document.body.style.overflow = "hidden";
    }

    return () => {
      document.removeEventListener("keydown", handleEscape);
      document.body.style.overflow = "unset";
    };
  }, [selectedItem, editingField]);

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
                onClick={() => setSelectedItem(item)}
                className="border-b border-gray-200 hover:bg-gray-50 transition-colors cursor-pointer"
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
                  <div
                    className="flex gap-1 justify-center"
                    onClick={(e) => e.stopPropagation()}
                  >
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

      {/* Drawer */}
      {selectedItem && localItem && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-black bg-opacity-50 z-40 transition-opacity animate-fade-in"
            onClick={() => {
              if (!editingField) {
                setSelectedItem(null);
              }
            }}
          />

          {/* Drawer Panel */}
          <div
            className={`fixed inset-y-0 right-0 w-full max-w-md bg-white shadow-xl z-50 transform transition-transform duration-300 ease-in-out ${
              isDrawerOpen ? "translate-x-0" : "translate-x-full"
            }`}
          >
            <div className="h-full flex flex-col">
              {/* Header */}
              <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
                {editingField === "name" ? (
                  <input
                    type="text"
                    value={editValue}
                    onChange={(e) => setEditValue(e.target.value)}
                    onKeyDown={handleKeyDown}
                    onBlur={handleSave}
                    autoFocus
                    disabled={isSaving}
                    className="flex-1 text-xl font-bold text-gray-900 bg-transparent border-b-2 border-blue-500 focus:outline-none"
                  />
                ) : (
                  <h3
                    onClick={() => handleStartEdit("name")}
                    className="text-xl font-bold text-gray-900 cursor-pointer hover:text-blue-600 transition-colors"
                  >
                    {localItem.name}
                    {isSaving && (
                      <span className="ml-2 text-sm text-gray-500">
                        Saving...
                      </span>
                    )}
                  </h3>
                )}
                <button
                  onClick={() => {
                    if (!editingField) {
                      setSelectedItem(null);
                    }
                  }}
                  className="text-gray-400 hover:text-gray-600 transition-colors"
                  disabled={editingField !== null}
                >
                  <svg
                    className="w-6 h-6"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M6 18L18 6M6 6l12 12"
                    />
                  </svg>
                </button>
              </div>

              {/* Content */}
              <div className="flex-1 overflow-y-auto px-6 py-4">
                <div className="space-y-6">
                  {/* Badge */}
                  <div>
                    <span
                      className={`inline-block px-3 py-1 rounded-full text-sm font-medium ${
                        localItem.is_serialized
                          ? "bg-blue-100 text-blue-800"
                          : "bg-gray-100 text-gray-800"
                      }`}
                    >
                      {localItem.is_serialized
                        ? "Serialized"
                        : "Non-Serialized"}
                    </span>
                  </div>

                  {/* Available / Total */}
                  <div>
                    <h4 className="text-sm font-semibold text-gray-700 mb-2">
                      Availability
                    </h4>
                    <p className="text-lg font-mono text-gray-900">
                      {localItem.available} / {localItem.total}
                    </p>
                  </div>

                  {/* Price */}
                  <div>
                    <h4 className="text-sm font-semibold text-gray-700 mb-2">
                      Price
                    </h4>
                    {editingField === "price" ? (
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={editValue}
                        onChange={(e) => setEditValue(e.target.value)}
                        onKeyDown={handleKeyDown}
                        onBlur={handleSave}
                        autoFocus
                        disabled={isSaving}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    ) : (
                      <p
                        onClick={() => handleStartEdit("price")}
                        className="text-gray-900 cursor-pointer hover:text-blue-600 transition-colors"
                      >
                        ${localItem.price.toFixed(2)}
                      </p>
                    )}
                  </div>

                  {/* Location */}
                  <div>
                    <h4 className="text-sm font-semibold text-gray-700 mb-2">
                      Location
                    </h4>
                    <p className="text-gray-600">Placeholder</p>
                  </div>

                  {/* Maintenance */}
                  <div>
                    <h4 className="text-sm font-semibold text-gray-700 mb-2">
                      Maintenance
                    </h4>
                    <p className="text-gray-600">Placeholder</p>
                  </div>

                  {/* Units (only if serialized) */}
                  {localItem.is_serialized && (
                    <div>
                      <h4 className="text-sm font-semibold text-gray-700 mb-2">
                        Units
                      </h4>
                      <p className="text-gray-600">Placeholder</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
