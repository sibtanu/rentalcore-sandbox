"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import type { QuoteWithItems } from "@/lib/quotes";
import {
  getItemAvailabilityBreakdown,
  calculateQuoteRisk,
  type ItemAvailabilityBreakdown,
  type RiskLevel,
} from "@/lib/quotes";
import AddItemModal from "./AddItemModal";

interface QuoteDetailPageProps {
  initialQuote: QuoteWithItems;
  updateQuote: (
    formData: FormData,
  ) => Promise<{ error?: string; success?: boolean }>;
  deleteQuote: (
    formData: FormData,
  ) => Promise<{ error?: string; success?: boolean }>;
  addQuoteItem: (
    formData: FormData,
  ) => Promise<{ error?: string; success?: boolean }>;
  updateQuoteItem: (
    formData: FormData,
  ) => Promise<{ error?: string; success?: boolean }>;
  deleteQuoteItem: (
    formData: FormData,
  ) => Promise<{ error?: string; success?: boolean }>;
}

export default function QuoteDetailPage({
  initialQuote,
  updateQuote,
  deleteQuote,
  addQuoteItem,
  updateQuoteItem,
  deleteQuoteItem,
}: QuoteDetailPageProps) {
  const router = useRouter();
  const [quote, setQuote] = useState<QuoteWithItems>(initialQuote);
  const [showAddItemModal, setShowAddItemModal] = useState(false);
  const [itemAvailabilities, setItemAvailabilities] = useState<
    Map<string, ItemAvailabilityBreakdown>
  >(new Map());

  // Sync quote when initialQuote changes (after router.refresh())
  useEffect(() => {
    setQuote(initialQuote);
  }, [initialQuote]);

  // Fetch availability breakdowns for all items
  useEffect(() => {
    const fetchAvailabilities = async () => {
      const availMap = new Map<string, ItemAvailabilityBreakdown>();
      for (const item of quote.items) {
        try {
          const breakdown = await getItemAvailabilityBreakdown(item.item_id);
          availMap.set(item.item_id, breakdown);
        } catch (error) {
          console.error(
            `Error fetching availability breakdown for item ${item.item_id}:`,
            error,
          );
        }
      }
      setItemAvailabilities(availMap);
    };

    if (quote.items.length > 0) {
      fetchAvailabilities();
    } else {
      setItemAvailabilities(new Map());
    }
  }, [quote.items]);

  // Calculate event-level risk indicator
  const riskLevel = useMemo<RiskLevel>(() => {
    if (quote.items.length === 0) return "green";
    return calculateQuoteRisk(
      quote.items.map((item) => ({
        item_id: item.item_id,
        quantity: item.quantity,
        item_is_serialized: item.item_is_serialized,
      })),
      itemAvailabilities,
    );
  }, [quote.items, itemAvailabilities]);

  const handleAddItem = async (
    itemId: string,
    itemName: string,
    unitPrice: number,
    quantity: number,
  ) => {
    const formData = new FormData();
    formData.append("quote_id", quote.id);
    formData.append("item_id", itemId);
    formData.append("quantity", quantity.toString());

    const result = await addQuoteItem(formData);
    if (result.success) {
      router.refresh();
    } else if (result.error) {
      alert(result.error);
    }
  };

  const handleUpdateItem = async (quoteItemId: string, quantity: number) => {
    const formData = new FormData();
    formData.append("quote_item_id", quoteItemId);
    formData.append("quantity", quantity.toString());
    formData.append("quote_id", quote.id);

    const result = await updateQuoteItem(formData);
    if (result.success) {
      router.refresh();
    } else if (result.error) {
      alert(result.error);
    }
  };

  const handleDeleteItem = async (quoteItemId: string) => {
    const formData = new FormData();
    formData.append("quote_item_id", quoteItemId);

    const result = await deleteQuoteItem(formData);
    if (result.success) {
      router.refresh();
    }
  };

  const numberOfDays = Math.ceil(
    (new Date(quote.end_date).getTime() -
      new Date(quote.start_date).getTime()) /
      (1000 * 60 * 60 * 24),
  );

  const subtotal = quote.items.reduce((sum, item) => {
    return sum + item.quantity * item.unit_price_snapshot * numberOfDays;
  }, 0);

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto p-8">
        {/* Header */}
        <div className="mb-6">
          <Link
            href="/quotes"
            className="text-sm text-gray-600 hover:text-gray-900 mb-4 inline-block"
          >
            ← Back to Quotes
          </Link>
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-3xl font-bold text-gray-900">
                  {quote.name}
                </h1>
                {/* Event-level risk indicator */}
                {quote.items.length > 0 && (
                  <div
                    className={`px-3 py-1 rounded-full text-sm font-medium flex items-center gap-2 ${
                      riskLevel === "green"
                        ? "bg-green-100 text-green-800"
                        : riskLevel === "yellow"
                          ? "bg-yellow-100 text-yellow-800"
                          : "bg-red-100 text-red-800"
                    }`}
                  >
                    <div
                      className={`w-2 h-2 rounded-full ${
                        riskLevel === "green"
                          ? "bg-green-600"
                          : riskLevel === "yellow"
                            ? "bg-yellow-600"
                            : "bg-red-600"
                      }`}
                    />
                    {riskLevel === "green"
                      ? "Sufficient inventory"
                      : riskLevel === "yellow"
                        ? "Tight availability"
                        : "Insufficient inventory"}
                  </div>
                )}
              </div>
              <p className="text-gray-600 mt-1">
                {new Date(quote.start_date).toLocaleDateString()} -{" "}
                {new Date(quote.end_date).toLocaleDateString()} ({numberOfDays}{" "}
                days)
              </p>
            </div>
            <span
              className={`px-3 py-1 rounded-full text-sm font-medium ${
                quote.status === "draft"
                  ? "bg-gray-100 text-gray-800"
                  : quote.status === "sent"
                    ? "bg-blue-100 text-blue-800"
                    : quote.status === "accepted"
                      ? "bg-green-100 text-green-800"
                      : "bg-red-100 text-red-800"
              }`}
            >
              {quote.status.charAt(0).toUpperCase() + quote.status.slice(1)}
            </span>
          </div>
        </div>

        {/* Items Section */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900">Items</h2>
            <button
              onClick={() => setShowAddItemModal(true)}
              className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 transition-colors"
            >
              + Add Item
            </button>
          </div>

          {quote.items.length === 0 ? (
            <div className="text-center text-gray-500 py-8 text-sm">
              No items yet. Click "+ Add Item" to get started.
            </div>
          ) : (
            <div className="space-y-3">
              {quote.items.map((item) => {
                const breakdown = itemAvailabilities.get(item.item_id) || {
                  available: 0,
                  reserved: 0,
                  inTransit: 0,
                  outOfService: 0,
                  total: 0,
                };
                const lineTotal =
                  item.quantity * item.unit_price_snapshot * numberOfDays;
                const isOverAvailable = item.quantity > breakdown.available;

                return (
                  <div
                    key={item.id}
                    className="p-4 bg-gray-50 rounded-lg border border-gray-200"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <h3 className="font-medium text-gray-900">
                            {item.item_name || "Unknown Item"}
                          </h3>
                          {isOverAvailable && (
                            <span className="px-2 py-0.5 text-xs bg-yellow-100 text-yellow-800 rounded">
                              Over available ({breakdown.available} available)
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-4 text-sm text-gray-600">
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() =>
                                handleUpdateItem(item.id, item.quantity - 1)
                              }
                              disabled={item.quantity <= 1}
                              className="w-7 h-7 flex items-center justify-center rounded border border-gray-300 hover:bg-gray-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
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
                                  d="M20 12H4"
                                />
                              </svg>
                            </button>
                            <span className="w-8 text-center font-medium">
                              {item.quantity}
                            </span>
                            <button
                              onClick={() =>
                                handleUpdateItem(item.id, item.quantity + 1)
                              }
                              className="w-7 h-7 flex items-center justify-center rounded border border-gray-300 hover:bg-gray-100 transition-colors"
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
                                  d="M12 4v16m8-8H4"
                                />
                              </svg>
                            </button>
                          </div>
                          <span>× ${item.unit_price_snapshot.toFixed(2)}</span>
                          <span>
                            × {numberOfDays} day{numberOfDays !== 1 ? "s" : ""}
                          </span>
                        </div>
                        {/* Availability breakdown */}
                        <div className="mt-2 flex items-center gap-4 text-xs text-gray-500">
                          <span>
                            <span className="font-medium text-gray-700">
                              Available:
                            </span>{" "}
                            {breakdown.available}
                          </span>
                          {breakdown.reserved > 0 && (
                            <span>
                              <span className="font-medium text-gray-700">
                                Reserved:
                              </span>{" "}
                              {breakdown.reserved}
                            </span>
                          )}
                          {/* Only show In-Transit for serialized items */}
                          {item.item_is_serialized &&
                            breakdown.inTransit > 0 && (
                              <span>
                                <span className="font-medium text-gray-700">
                                  In-Transit:
                                </span>{" "}
                                {breakdown.inTransit}
                              </span>
                            )}
                          {breakdown.outOfService > 0 && (
                            <span>
                              <span className="font-medium text-gray-700">
                                Out-of-Service:
                              </span>{" "}
                              {breakdown.outOfService}
                            </span>
                          )}
                          <span>
                            <span className="font-medium text-gray-700">
                              Total:
                            </span>{" "}
                            {breakdown.total}
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="text-right">
                          <div className="text-sm font-semibold text-gray-900">
                            ${lineTotal.toFixed(2)}
                          </div>
                          <div className="text-xs text-gray-500">
                            Line total
                          </div>
                        </div>
                        <button
                          onClick={() => handleDeleteItem(item.id)}
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
                              d="M6 18L18 6M6 6l12 12"
                            />
                          </svg>
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Summary */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="space-y-2">
            <div className="flex justify-between text-sm text-gray-600">
              <span>Days</span>
              <span>
                {numberOfDays} day{numberOfDays !== 1 ? "s" : ""}
              </span>
            </div>
            <div className="flex justify-between text-sm text-gray-600">
              <span>Subtotal</span>
              <span>${subtotal.toFixed(2)}</span>
            </div>
            <div className="flex justify-between items-center pt-2 border-t border-gray-200">
              <span className="text-base font-semibold text-gray-900">
                Total
              </span>
              <span className="text-2xl font-bold text-gray-900">
                ${subtotal.toFixed(2)}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Add Item Modal */}
      {showAddItemModal && (
        <AddItemModal
          onClose={() => setShowAddItemModal(false)}
          onAddItem={handleAddItem}
        />
      )}
    </div>
  );
}
