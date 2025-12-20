"use client";

import { useState, useEffect, useTransition } from "react";
import { flushSync } from "react-dom";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { InventoryGroup, InventoryItem } from "@/lib/inventory";
import { supabase } from "@/lib/supabase";
import SortableItemRow from "./SortableItemRow";

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
  createItem: (
    formData: FormData,
  ) => Promise<
    | { ok: true }
    | {
        ok: false;
        error: "DUPLICATE_NAME" | "VALIDATION_ERROR" | "SERVER_ERROR";
      }
  >;
  moveItem: (formData: FormData) => Promise<void>;
  updateItem: (formData: FormData) => Promise<void>;
  updateStock: (formData: FormData) => Promise<void>;
  addMaintenanceLog: (formData: FormData) => Promise<void>;
  updateUnitStatus: (formData: FormData) => Promise<void>;
  reorderItems: (formData: FormData) => Promise<void>;
  deleteItem: (
    formData: FormData,
  ) => Promise<{ error?: string; success?: boolean }>;
  deleteGroup: (
    formData: FormData,
  ) => Promise<{ error?: string; success?: boolean }>;
}

export default function InventoryGroupCard({
  group: initialGroup,
  createItem,
  moveItem,
  updateItem,
  updateStock,
  addMaintenanceLog,
  updateUnitStatus,
  reorderItems,
  deleteItem,
  deleteGroup,
}: InventoryGroupCardProps) {
  const [group, setGroup] = useState(initialGroup);
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
  const [updatingUnitId, setUpdatingUnitId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const [lastFetchedItemId, setLastFetchedItemId] = useState<string | null>(
    null,
  );
  const [mounted, setMounted] = useState(false);
  const [showDeleteItemModal, setShowDeleteItemModal] = useState(false);
  const [showDeleteGroupModal, setShowDeleteGroupModal] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [createItemError, setCreateItemError] = useState<string | null>(null);

  // Only render DndContext on client to avoid hydration mismatch
  useEffect(() => {
    setMounted(true);
  }, []);

  // Sensors for drag and drop
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  // Update group when prop changes (but preserve local state during drag)
  useEffect(() => {
    // Always sync with initialGroup when it changes (e.g., after revalidation)
    if (initialGroup.id === group.id) {
      // Check if items have actually changed by comparing IDs
      const initialItemIds = new Set(initialGroup.items.map((item) => item.id));
      const currentItemIds = new Set(group.items.map((item) => item.id));

      // If initialGroup has new items (not in current state), update
      const hasNewItems = initialGroup.items.some(
        (item) => !currentItemIds.has(item.id),
      );

      // If items were removed from server (deleted items), update
      const hasRemovedItems =
        initialGroup.items.length < group.items.length &&
        !group.items.some((item) => item.id.startsWith("temp-"));

      // If current state has temp items that aren't in initialGroup, keep them temporarily
      const hasTempItems = Array.from(currentItemIds).some(
        (id) => id.startsWith("temp-") && !initialItemIds.has(id),
      );

      // Update if there are new real items, removed items, or if counts differ (and no temp items)
      if (
        hasNewItems ||
        hasRemovedItems ||
        (!hasTempItems && initialGroup.items.length !== group.items.length)
      ) {
        setGroup(initialGroup);
      }
    } else {
      setGroup(initialGroup);
    }
  }, [initialGroup]);

  const handleItemDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;

    if (!over || active.id === over.id) return;

    const oldIndex = group.items.findIndex((item) => item.id === active.id);
    const newIndex = group.items.findIndex((item) => item.id === over.id);

    if (oldIndex === -1 || newIndex === -1) return;

    // Optimistic update
    const newItems = arrayMove(group.items, oldIndex, newIndex);
    setGroup({ ...group, items: newItems });

    // Update display_order values
    const itemOrders: Record<string, number> = {};
    newItems.forEach((item: InventoryItem, index: number) => {
      itemOrders[item.id] = index;
    });

    const formData = new FormData();
    formData.append("group_id", group.id);
    formData.append("item_orders", JSON.stringify(itemOrders));

    try {
      await reorderItems(formData);
    } catch (error) {
      console.error("Error reordering items:", error);
      // Revert on error - restore from current group state before optimistic update
      setGroup(initialGroup);
    }
  };

  useEffect(() => {
    if (selectedItem) {
      const itemId = selectedItem.id;
      const wasOpen = isDrawerOpen;

      setLocalItem(selectedItem);

      // Only trigger animation if drawer wasn't already open
      if (!wasOpen) {
        setTimeout(() => setIsDrawerOpen(true), 10);
      }

      // Only fetch data if this is a new item (different ID)
      // This prevents refetching when selectedItem is updated optimistically
      if (itemId !== lastFetchedItemId) {
        setLastFetchedItemId(itemId);

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
      }
    } else {
      setIsDrawerOpen(false);
      setLocalItem(null);
      setEditingField(null);
      setUnits([]);
      setStock(null);
      setStockError(null);
      setMaintenanceLogs([]);
      setNewLogNote("");
      setLastFetchedItemId(null);
    }
  }, [selectedItem?.id]); // Only depend on item ID, not the whole object

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

      // Only update availability on initial load, not during updates
      // This prevents glitches when revalidation happens
      if (localItem && localItem.is_serialized && !updatingUnitId) {
        const availableCount = formattedUnits.filter(
          (u) => u.status === "available",
        ).length;
        const totalCount = formattedUnits.length;

        // Only update if values actually changed to prevent unnecessary re-renders
        if (
          localItem.available !== availableCount ||
          localItem.total !== totalCount
        ) {
          setLocalItem({
            ...localItem,
            available: availableCount,
            total: totalCount,
          });
          setSelectedItem({
            ...localItem,
            available: availableCount,
            total: totalCount,
          });
        }
      }
    } catch (error) {
      console.error("Error fetching units:", error);
      setUnits([]);
    } finally {
      setIsLoadingUnits(false);
    }
  };

  const fetchStock = async (itemId: string) => {
    // Skip fetching if this is a temporary ID
    if (itemId.startsWith("temp-")) {
      setStock({ total_quantity: 0, out_of_service_quantity: 0 });
      setIsLoadingStock(false);
      setStockError(null);
      return;
    }

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

  const handleDeleteItem = async () => {
    if (!localItem) return;

    setIsDeleting(true);
    setDeleteError(null);

    const itemToDelete = localItem;

    // If this is a temporary item (not yet saved to DB), just remove it locally
    if (itemToDelete.id.startsWith("temp-")) {
      setGroup({
        ...group,
        items: group.items.filter((item) => item.id !== itemToDelete.id),
      });
      setShowDeleteItemModal(false);
      setSelectedItem(null);
      setIsDeleting(false);
      return;
    }

    // Optimistically remove item from list immediately
    setGroup({
      ...group,
      items: group.items.filter((item) => item.id !== itemToDelete.id),
    });

    // Close drawer
    setShowDeleteItemModal(false);
    setSelectedItem(null);

    const formData = new FormData();
    formData.append("item_id", itemToDelete.id);

    try {
      const result = await deleteItem(formData);
      if (result.error) {
        setDeleteError(result.error);
        // Revert optimistic update on error
        setGroup({
          ...group,
          items: [...group.items, itemToDelete],
        });
        setShowDeleteItemModal(true);
      }
      // Revalidation will refresh the data and confirm the deletion
    } catch (error) {
      setDeleteError("Failed to delete item");
      // Revert optimistic update on error
      setGroup({
        ...group,
        items: [...group.items, itemToDelete],
      });
      setShowDeleteItemModal(true);
    } finally {
      setIsDeleting(false);
    }
  };

  const handleDeleteGroup = async () => {
    setIsDeleting(true);
    setDeleteError(null);

    const formData = new FormData();
    formData.append("group_id", group.id);

    try {
      const result = await deleteGroup(formData);
      if (result.error) {
        setDeleteError(result.error);
      } else {
        setShowDeleteGroupModal(false);
        // Revalidation will refresh the data
      }
    } catch (error) {
      setDeleteError("Failed to delete group");
    } finally {
      setIsDeleting(false);
    }
  };

  const handleUnitStatusChange = async (
    unitId: string,
    currentStatus: string,
  ) => {
    if (updatingUnitId === unitId) return;

    let newStatus: string;
    if (currentStatus === "available") {
      newStatus = "out";
    } else if (currentStatus === "out") {
      newStatus = "available";
    } else {
      return; // maintenance status - no action
    }

    setUpdatingUnitId(unitId);

    // Optimistic update
    const updatedUnits = units.map((unit) =>
      unit.id === unitId
        ? { ...unit, status: newStatus as Unit["status"] }
        : unit,
    );
    setUnits(updatedUnits);

    // Update local item availability based on updated units
    if (localItem) {
      const availableCount = updatedUnits.filter(
        (u) => u.status === "available",
      ).length;
      const totalCount = updatedUnits.length;

      setLocalItem({
        ...localItem,
        available: availableCount,
        total: totalCount,
      });
      setSelectedItem({
        ...localItem,
        available: availableCount,
        total: totalCount,
      });
    }

    const formData = new FormData();
    formData.append("unit_id", unitId);
    formData.append("status", newStatus);

    // Use startTransition to make the update non-blocking and prevent UI glitches
    startTransition(async () => {
      try {
        await updateUnitStatus(formData);
        // Optimistic update is sufficient - revalidation will sync data in background
        // Don't refresh units here to prevent glitch
      } catch (error) {
        console.error("Error updating unit status:", error);
        // Revert optimistic update on error
        setUnits(units);
        if (localItem) {
          const availableCount = units.filter(
            (u) => u.status === "available",
          ).length;
          const totalCount = units.length;
          setLocalItem({
            ...localItem,
            available: availableCount,
            total: totalCount,
          });
          setSelectedItem({
            ...localItem,
            available: availableCount,
            total: totalCount,
          });
        }
      } finally {
        setUpdatingUnitId(null);
      }
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

  const isUncategorized = group.name === "Uncategorized";

  return (
    <div className="mb-10 bg-white rounded-lg shadow-sm border border-gray-200 p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-bold text-gray-900">{group.name}</h2>
        {!isUncategorized && (
          <button
            onClick={() => {
              setDeleteError(null);
              setShowDeleteGroupModal(true);
            }}
            className="px-3 py-1.5 text-sm text-red-600 hover:text-red-700 hover:bg-red-50 rounded-md transition-colors"
          >
            Delete Group
          </button>
        )}
      </div>

      {/* Error message for item creation */}
      {createItemError && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md">
          <div className="flex items-center justify-between">
            <p className="text-sm text-red-800">{createItemError}</p>
            <button
              onClick={() => setCreateItemError(null)}
              className="text-red-600 hover:text-red-800"
            >
              <svg
                className="w-4 h-4"
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
        </div>
      )}

      <form
        onSubmit={async (e) => {
          e.preventDefault();
          const formData = new FormData(e.currentTarget);
          const name = String(formData.get("name") || "").trim();
          const isSerialized = formData.get("is_serialized") === "on";

          if (!name) return;

          // Clear any previous error
          setCreateItemError(null);

          // Reset form
          e.currentTarget.reset();

          // Call server action FIRST - don't add optimistically
          try {
            const result = await createItem(formData);
            if (!result.ok) {
              // Show error immediately - no temp item to remove
              if (result.error === "DUPLICATE_NAME") {
                setCreateItemError(
                  `An item with the name "${name}" already exists`,
                );
              } else if (result.error === "VALIDATION_ERROR") {
                setCreateItemError("Name and Group ID are required");
              } else {
                setCreateItemError("Failed to create item. Please try again.");
              }

              // Auto-hide error after 5 seconds
              setTimeout(() => {
                setCreateItemError(null);
              }, 5000);
              return;
            }
            // Success - add optimistically AFTER server confirms
            const tempId = `temp-${Date.now()}`;
            const newItem: InventoryItem = {
              id: tempId,
              name,
              group_id: group.id,
              is_serialized: isSerialized,
              price: 0,
              available: 0,
              total: 0,
            };

            setGroup({
              ...group,
              items: [...group.items, newItem],
            });
            // Revalidation will replace temp item with real one
          } catch (error) {
            setCreateItemError("Failed to create item. Please try again.");
            setTimeout(() => {
              setCreateItemError(null);
            }, 5000);
          }
        }}
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

      {mounted ? (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleItemDragEnd}
        >
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="border-b-2 border-gray-300">
                  <th className="text-left py-3 px-4 font-semibold text-gray-700">
                    Item
                  </th>
                  <th className="text-right py-3 px-4 font-semibold text-gray-700">
                    Available / Total
                  </th>
                </tr>
              </thead>
              <SortableContext
                items={group.items.map((item) => item.id)}
                strategy={verticalListSortingStrategy}
              >
                <tbody>
                  {group.items.map((item) => (
                    <SortableItemRow
                      key={item.id}
                      item={item}
                      onItemClick={setSelectedItem}
                    />
                  ))}
                </tbody>
              </SortableContext>
            </table>
          </div>
        </DndContext>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr className="border-b-2 border-gray-300">
                <th className="text-left py-3 px-4 font-semibold text-gray-700">
                  Item
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
                  <td className="py-3 px-4 text-right text-gray-700 font-mono">
                    {item.available} / {item.total}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

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
            className={`fixed inset-y-0 right-0 w-full max-w-lg bg-white shadow-xl z-50 transform transition-transform duration-300 ease-in-out ${
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
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => {
                      setDeleteError(null);
                      setShowDeleteItemModal(true);
                    }}
                    disabled={editingField !== null}
                    className="px-3 py-1.5 text-sm text-red-600 hover:text-red-700 hover:bg-red-50 rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Delete
                  </button>
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
                                <th className="text-left py-2 px-3 font-semibold text-gray-700">
                                  Action
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
                                  <td className="py-2 px-3">
                                    {unit.status === "available" && (
                                      <button
                                        onClick={() =>
                                          handleUnitStatusChange(
                                            unit.id,
                                            unit.status,
                                          )
                                        }
                                        disabled={updatingUnitId === unit.id}
                                        className="px-2 py-1 bg-red-600 text-white text-xs rounded hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                      >
                                        {updatingUnitId === unit.id
                                          ? "Updating..."
                                          : "Check Out"}
                                      </button>
                                    )}
                                    {unit.status === "out" && (
                                      <button
                                        onClick={() =>
                                          handleUnitStatusChange(
                                            unit.id,
                                            unit.status,
                                          )
                                        }
                                        disabled={updatingUnitId === unit.id}
                                        className="px-2 py-1 bg-green-600 text-white text-xs rounded hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                      >
                                        {updatingUnitId === unit.id
                                          ? "Updating..."
                                          : "Check In"}
                                      </button>
                                    )}
                                    {unit.status === "maintenance" && (
                                      <span className="text-xs text-gray-400">
                                        —
                                      </span>
                                    )}
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

      {/* Delete Item Confirmation Modal */}
      {showDeleteItemModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              Remove Item
            </h3>
            <p className="text-gray-600 mb-4">
              Are you sure you want to remove "{localItem?.name}" from
              inventory?
              <br />
              <span className="text-sm text-gray-500">
                This action cannot be undone.
              </span>
            </p>
            {deleteError && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md">
                <p className="text-sm text-red-800">{deleteError}</p>
              </div>
            )}
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => {
                  setShowDeleteItemModal(false);
                  setDeleteError(null);
                }}
                disabled={isDeleting}
                className="px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-md transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteItem}
                disabled={isDeleting}
                className="px-4 py-2 bg-red-600 text-white hover:bg-red-700 rounded-md transition-colors disabled:opacity-50"
              >
                {isDeleting ? "Removing..." : "Remove"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Group Confirmation Modal */}
      {showDeleteGroupModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              Delete Group
            </h3>
            <p className="text-gray-600 mb-4">
              This will remove the group. All items will be moved to
              'Uncategorized'.
            </p>
            {deleteError && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md">
                <p className="text-sm text-red-800">{deleteError}</p>
              </div>
            )}
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => {
                  setShowDeleteGroupModal(false);
                  setDeleteError(null);
                }}
                disabled={isDeleting}
                className="px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-md transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteGroup}
                disabled={isDeleting}
                className="px-4 py-2 bg-red-600 text-white hover:bg-red-700 rounded-md transition-colors disabled:opacity-50"
              >
                {isDeleting ? "Deleting..." : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
