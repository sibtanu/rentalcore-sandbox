"use client";

import { useState, useEffect } from "react";
import type { InventoryGroup, InventoryItem } from "@/lib/inventory";
import { supabase } from "@/lib/supabase";

interface Unit {
  id: string;
  serial_number: string;
  barcode: string;
  status: "available" | "out" | "maintenance";
  location_name: string;
}

interface MaintenanceLog {
  id: string;
  note: string;
  created_at: string;
}

interface Stock {
  total_quantity: number;
  out_of_service_quantity: number;
}

interface InventoryGroupCardProps {
  group: InventoryGroup;
  createItem: (formData: FormData) => Promise<void>;
  moveItem: (formData: FormData) => Promise<void>;
  updateItem: (formData: FormData) => Promise<void>;
  updateStock: (formData: FormData) => Promise<void>;
  addMaintenanceLog: (formData: FormData) => Promise<void>;
}

export default function InventoryGroupCard({
  group,
  createItem,
  moveItem,
  updateItem,
  updateStock,
  addMaintenanceLog,
}: InventoryGroupCardProps) {
  const [selectedItem, setSelectedItem] = useState<InventoryItem | null>(null);
  const [localItem, setLocalItem] = useState<InventoryItem | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [editingField, setEditingField] = useState<"name" | "price" | null>(
    null,
  );
  const [isSaving, setIsSaving] = useState(false);
  const [editValue, setEditValue] = useState<string>("");
  const [units, setUnits] = useState<Unit[]>([]);
  const [isLoadingUnits, setIsLoadingUnits] = useState(false);
  const [stock, setStock] = useState<Stock | null>(null);
  const [isLoadingStock, setIsLoadingStock] = useState(false);
  const [isSavingStock, setIsSavingStock] = useState(false);
  const [stockError, setStockError] = useState<string | null>(null);
  const [maintenanceLogs, setMaintenanceLogs] = useState<MaintenanceLog[]>([]);
  const [isLoadingLogs, setIsLoadingLogs] = useState(false);
  const [newLogNote, setNewLogNote] = useState<string>("");
  const [isAddingLog, setIsAddingLog] = useState(false);

  useEffect(() => {
    if (selectedItem) {
      setLocalItem(selectedItem);
      // Trigger animation after DOM update
      setTimeout(() => setIsDrawerOpen(true), 10);

      // Fetch units if item is serialized
      if (selectedItem.is_serialized) {
        fetchUnits(selectedItem.id);
        setStock(null);
      } else {
        setUnits([]);
        fetchStock(selectedItem.id);
      }

      // Always fetch maintenance logs
      fetchMaintenanceLogs(selectedItem.id);
    } else {
      setIsDrawerOpen(false);
      setLocalItem(null);
      setEditingField(null);
      setUnits([]);
      setStock(null);
      setStockError(null);
      setMaintenanceLogs([]);
      setNewLogNote("");
    }
  }, [selectedItem]);

  const fetchUnits = async (itemId: string) => {
    setIsLoadingUnits(true);
    try {
      const { data: unitsData, error } = await supabase
        .from("inventory_units")
        .select(
          `
          id,
          serial_number,
          barcode,
          status,
          locations:location_id (
            name
          )
        `,
        )
        .eq("item_id", itemId)
        .order("created_at", { ascending: false });

      if (error) {
        console.error("Error fetching units:", error);
        setUnits([]);
        return;
      }

      const formattedUnits: Unit[] =
        unitsData?.map((unit: any) => ({
          id: unit.id,
          serial_number: unit.serial_number,
          barcode: unit.barcode,
          status: unit.status,
          location_name: unit.locations?.name || "Unknown",
        })) || [];

      setUnits(formattedUnits);
    } catch (error) {
      console.error("Error fetching units:", error);
      setUnits([]);
    } finally {
      setIsLoadingUnits(false);
    }
  };

  const fetchStock = async (itemId: string) => {
    setIsLoadingStock(true);
    setStockError(null);
    try {
      const { data: stockData, error } = await supabase
        .from("inventory_stock")
        .select("total_quantity, out_of_service_quantity")
        .eq("item_id", itemId)
        .limit(1)
        .single();

      if (error && error.code !== "PGRST116") {
        // PGRST116 is "not found" error, which is OK
        console.error("Error fetching stock:", error);
        setStockError("Failed to load stock data");
        setStock(null);
        return;
      }

      setStock(
        stockData
          ? {
              total_quantity: stockData.total_quantity,
              out_of_service_quantity: stockData.out_of_service_quantity || 0,
            }
          : { total_quantity: 0, out_of_service_quantity: 0 },
      );
    } catch (error) {
      console.error("Error fetching stock:", error);
      setStockError("Failed to load stock data");
      setStock(null);
    } finally {
      setIsLoadingStock(false);
    }
  };

  const handleStockChange = (
    field: "total_quantity" | "out_of_service_quantity",
    value: string,
  ) => {
    if (!stock) return;

    const numValue = value === "" ? 0 : Number(value);
    if (Number.isNaN(numValue) || numValue < 0) return;

    setStock({
      ...stock,
      [field]: numValue,
    });
    setStockError(null);
  };

  const handleStockSave = async () => {
    if (!stock || !localItem) return;

    // Validation
    if (
      stock.total_quantity < 0 ||
      stock.out_of_service_quantity < 0 ||
      stock.out_of_service_quantity > stock.total_quantity
    ) {
      setStockError("Invalid values");
      return;
    }

    setIsSavingStock(true);
    setStockError(null);

    const formData = new FormData();
    formData.append("item_id", localItem.id);
    formData.append("total_quantity", stock.total_quantity.toString());
    formData.append(
      "out_of_service_quantity",
      stock.out_of_service_quantity.toString(),
    );

    try {
      await updateStock(formData);
      // Update local item availability
      const available = stock.total_quantity - stock.out_of_service_quantity;
      setLocalItem({
        ...localItem,
        total: stock.total_quantity,
        available,
      });
      setSelectedItem({
        ...localItem,
        total: stock.total_quantity,
        available,
      });
    } catch (error) {
      setStockError("Failed to save stock");
    } finally {
      setIsSavingStock(false);
    }
  };

  const fetchMaintenanceLogs = async (itemId: string) => {
    setIsLoadingLogs(true);
    try {
      const { data: logsData, error } = await supabase
        .from("inventory_maintenance_logs")
        .select("id, note, created_at")
        .eq("item_id", itemId)
        .order("created_at", { ascending: false });

      if (error) {
        console.error("Error fetching maintenance logs:", error);
        setMaintenanceLogs([]);
        return;
      }

      setMaintenanceLogs(logsData || []);
    } catch (error) {
      console.error("Error fetching maintenance logs:", error);
      setMaintenanceLogs([]);
    } finally {
      setIsLoadingLogs(false);
    }
  };

  const handleAddMaintenanceLog = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newLogNote.trim() || !localItem || isAddingLog) return;

    setIsAddingLog(true);
    const noteToAdd = newLogNote.trim();

    const formData = new FormData();
    formData.append("item_id", localItem.id);
    formData.append("note", noteToAdd);

    try {
      await addMaintenanceLog(formData);
      setNewLogNote("");
      // Refresh logs
      await fetchMaintenanceLogs(localItem.id);
    } catch (error) {
      console.error("Error adding maintenance log:", error);
    } finally {
      setIsAddingLog(false);
    }
  };

  const formatTimestamp = (timestamp: string) => {
    const date = new Date(timestamp);
    return date.toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  };

  const handleStartEdit = (field: "name" | "price") => {
    if (!localItem) return;
    setEditingField(field);
    setEditValue(
      field === "name" ? localItem.name : localItem.price.toString(),
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
              <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between gap-4">
                <div className="flex-1 min-w-0">
                  {editingField === "name" ? (
                    <input
                      type="text"
                      value={editValue}
                      onChange={(e) => setEditValue(e.target.value)}
                      onKeyDown={handleKeyDown}
                      onBlur={handleSave}
                      autoFocus
                      disabled={isSaving}
                      className="w-full text-xl font-bold text-gray-900 bg-white border-b-2 border-blue-500 focus:outline-none"
                    />
                  ) : (
                    <h3
                      onClick={() => handleStartEdit("name")}
                      className="text-xl font-bold text-gray-900 cursor-pointer hover:text-blue-600 transition-colors line-clamp-2"
                      title={localItem.name}
                    >
                      {localItem.name}
                      {isSaving && (
                        <span className="ml-2 text-sm text-gray-500">
                          Saving...
                        </span>
                      )}
                    </h3>
                  )}
                </div>
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

                  {/* Stock Editor (only if non-serialized) */}
                  {!localItem.is_serialized && (
                    <div>
                      <h4 className="text-sm font-semibold text-gray-700 mb-3">
                        Stock
                      </h4>
                      {isLoadingStock ? (
                        <div className="text-sm text-gray-500 py-2">
                          Loading stock...
                        </div>
                      ) : stock ? (
                        <div className="space-y-3">
                          <div>
                            <label className="block text-xs text-gray-600 mb-1">
                              Total Quantity
                            </label>
                            <input
                              type="number"
                              min="0"
                              value={stock.total_quantity}
                              onChange={(e) =>
                                handleStockChange(
                                  "total_quantity",
                                  e.target.value,
                                )
                              }
                              onBlur={handleStockSave}
                              disabled={isSavingStock}
                              className="w-full px-3 py-2 bg-white text-gray-900 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                            />
                          </div>
                          <div>
                            <label className="block text-xs text-gray-600 mb-1">
                              Out of Service
                            </label>
                            <input
                              type="number"
                              min="0"
                              max={stock.total_quantity}
                              value={stock.out_of_service_quantity}
                              onChange={(e) =>
                                handleStockChange(
                                  "out_of_service_quantity",
                                  e.target.value,
                                )
                              }
                              onBlur={handleStockSave}
                              disabled={isSavingStock}
                              className="w-full px-3 py-2 bg-white text-gray-900 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                            />
                          </div>
                          <div className="pt-2 border-t border-gray-200">
                            <div className="flex justify-between items-center">
                              <span className="text-xs text-gray-600">
                                Available
                              </span>
                              <span className="text-sm font-semibold text-gray-900">
                                {stock.total_quantity -
                                  stock.out_of_service_quantity}
                              </span>
                            </div>
                          </div>
                          {isSavingStock && (
                            <div className="text-xs text-gray-500">
                              Saving...
                            </div>
                          )}
                          {stockError && (
                            <div className="text-xs text-red-600">
                              {stockError}
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="text-sm text-gray-500 py-2">
                          {stockError || "No stock data"}
                        </div>
                      )}
                    </div>
                  )}

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
                        className="w-full px-3 py-2 bg-white text-gray-900 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
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

                  {/* Maintenance Log */}
                  <div>
                    <h4 className="text-sm font-semibold text-gray-700 mb-3">
                      Maintenance Log
                    </h4>
                    {isLoadingLogs ? (
                      <div className="text-sm text-gray-500 py-2">
                        Loading logs...
                      </div>
                    ) : (
                      <>
                        {maintenanceLogs.length === 0 ? (
                          <div className="text-sm text-gray-500 py-2 mb-3">
                            No maintenance logs
                          </div>
                        ) : (
                          <div className="max-h-64 overflow-y-auto border border-gray-200 rounded-md mb-3">
                            <div className="divide-y divide-gray-200">
                              {maintenanceLogs.map((log) => (
                                <div
                                  key={log.id}
                                  className="px-3 py-2 hover:bg-gray-50"
                                >
                                  <div className="text-xs text-gray-500 mb-1">
                                    {formatTimestamp(log.created_at)}
                                  </div>
                                  <div className="text-sm text-gray-900">
                                    {log.note}
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                        <form onSubmit={handleAddMaintenanceLog}>
                          <div className="flex gap-2">
                            <input
                              type="text"
                              value={newLogNote}
                              onChange={(e) => setNewLogNote(e.target.value)}
                              placeholder="Add maintenance note..."
                              disabled={isAddingLog}
                              className="flex-1 px-3 py-2 bg-white text-gray-900 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                            />
                            <button
                              type="submit"
                              disabled={!newLogNote.trim() || isAddingLog}
                              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                              {isAddingLog ? "Adding..." : "Add"}
                            </button>
                          </div>
                        </form>
                      </>
                    )}
                  </div>

                  {/* Units (only if serialized) */}
                  {localItem.is_serialized && (
                    <div>
                      <h4 className="text-sm font-semibold text-gray-700 mb-3">
                        Units
                      </h4>
                      {isLoadingUnits ? (
                        <div className="text-sm text-gray-500 py-4">
                          Loading units...
                        </div>
                      ) : units.length === 0 ? (
                        <div className="text-sm text-gray-500 py-4">
                          No units found
                        </div>
                      ) : (
                        <div className="max-h-96 overflow-y-auto border border-gray-200 rounded-md">
                          <table className="w-full border-collapse text-sm">
                            <thead className="sticky top-0 bg-white z-10">
                              <tr className="border-b border-gray-300">
                                <th className="text-left py-2 px-3 font-semibold text-gray-700">
                                  Serial Number
                                </th>
                                <th className="text-left py-2 px-3 font-semibold text-gray-700">
                                  Barcode
                                </th>
                                <th className="text-left py-2 px-3 font-semibold text-gray-700">
                                  Status
                                </th>
                                <th className="text-left py-2 px-3 font-semibold text-gray-700">
                                  Location
                                </th>
                              </tr>
                            </thead>
                            <tbody>
                              {units.map((unit) => (
                                <tr
                                  key={unit.id}
                                  className="border-b border-gray-200 hover:bg-gray-50 transition-colors"
                                >
                                  <td
                                    className="py-2 px-3 text-gray-900 truncate max-w-[120px]"
                                    title={unit.serial_number}
                                  >
                                    {unit.serial_number}
                                  </td>
                                  <td
                                    className="py-2 px-3 text-gray-900 font-mono truncate max-w-[120px]"
                                    title={unit.barcode}
                                  >
                                    {unit.barcode}
                                  </td>
                                  <td className="py-2 px-3">
                                    <span
                                      className={`inline-block px-2 py-1 rounded text-xs font-medium ${
                                        unit.status === "available"
                                          ? "bg-green-100 text-green-800"
                                          : unit.status === "out"
                                            ? "bg-red-100 text-red-800"
                                            : "bg-yellow-100 text-yellow-800"
                                      }`}
                                    >
                                      {unit.status}
                                    </span>
                                  </td>
                                  <td
                                    className="py-2 px-3 text-gray-700 truncate max-w-[120px]"
                                    title={unit.location_name}
                                  >
                                    {unit.location_name}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
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
