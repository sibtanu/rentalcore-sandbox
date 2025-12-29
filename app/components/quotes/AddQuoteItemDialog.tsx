"use client";

import { useState, useEffect, useRef } from "react";
import { searchInventoryItems } from "@/app/actions/quotes";

interface InventoryItem {
  id: string;
  name: string;
  price: number;
}

interface AddQuoteItemDialogProps {
  onClose: () => void;
  onAddItem: (itemId: string, quantity: number) => Promise<void>;
}

export default function AddQuoteItemDialog({
  onClose,
  onAddItem,
}: AddQuoteItemDialogProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<InventoryItem[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [selectedItem, setSelectedItem] = useState<InventoryItem | null>(null);
  const [quantity, setQuantity] = useState("1");
  const [isAdding, setIsAdding] = useState(false);
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    if (searchQuery.trim().length < 2) {
      setSearchResults([]);
      return;
    }

    setIsSearching(true);
    searchTimeoutRef.current = setTimeout(async () => {
      const results = await searchInventoryItems(searchQuery);
      setSearchResults(results);
      setIsSearching(false);
    }, 300);

    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, [searchQuery]);

  const handleSelectItem = (item: InventoryItem) => {
    setSelectedItem(item);
    setSearchQuery(item.name);
    setSearchResults([]);
  };

  const handleAdd = async () => {
    if (!selectedItem) return;

    const qty = parseInt(quantity, 10);
    if (Number.isNaN(qty) || qty <= 0) return;

    setIsAdding(true);
    await onAddItem(selectedItem.id, qty);
    setIsAdding(false);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center">
      <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4 max-h-[80vh] flex flex-col">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900">
            Add Item to Quote
          </h3>
          <button
            onClick={onClose}
            className="p-1 text-gray-400 hover:text-gray-600 rounded-md transition-colors"
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
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto space-y-4">
          {/* Search */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Search Items
            </label>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Type to search..."
              className="w-full px-3 py-2 bg-white text-gray-900 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            {isSearching && (
              <p className="text-xs text-gray-500 mt-1">Searching...</p>
            )}
          </div>

          {/* Search Results */}
          {searchQuery.trim().length >= 2 && !selectedItem && (
            <div className="border border-gray-200 rounded-md max-h-48 overflow-y-auto">
              {searchResults.length === 0 && !isSearching ? (
                <div className="p-4 text-center text-sm text-gray-500">
                  No items found
                </div>
              ) : (
                <div className="divide-y divide-gray-200">
                  {searchResults.map((item) => (
                    <button
                      key={item.id}
                      onClick={() => handleSelectItem(item)}
                      className="w-full p-3 text-left hover:bg-gray-50 transition-colors"
                    >
                      <div className="font-medium text-gray-900">
                        {item.name}
                      </div>
                      <div className="text-sm text-gray-600">
                        ${item.price.toFixed(2)}
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Selected Item */}
          {selectedItem && (
            <div className="p-4 bg-blue-50 border border-blue-200 rounded-md">
              <div className="font-medium text-gray-900 mb-1">
                {selectedItem.name}
              </div>
              <div className="text-sm text-gray-600">
                Price: ${selectedItem.price.toFixed(2)}
              </div>
            </div>
          )}

          {/* Quantity */}
          {selectedItem && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Quantity
              </label>
              <input
                type="number"
                min="1"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                className="w-full px-3 py-2 bg-white text-gray-900 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex gap-3 justify-end mt-4 pt-4 border-t border-gray-200">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleAdd}
            disabled={!selectedItem || isAdding}
            className="px-4 py-2 text-sm text-white bg-blue-600 rounded-md hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isAdding ? "Adding..." : "Add Item"}
          </button>
        </div>
      </div>
    </div>
  );
}
