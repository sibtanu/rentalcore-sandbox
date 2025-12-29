"use client";

import { useState } from "react";
import type { Quote } from "@/lib/quotes";
import QuoteDetailDrawer from "./QuoteDetailDrawer";
import { createQuote, updateQuote, deleteQuote } from "@/app/actions/quotes";

interface QuotesPageContentProps {
  initialQuotes: Quote[];
  createQuote: (
    formData: FormData,
  ) => Promise<{ error?: string; success?: boolean }>;
  updateQuote: (
    formData: FormData,
  ) => Promise<{ error?: string; success?: boolean }>;
  deleteQuote: (
    formData: FormData,
  ) => Promise<{ error?: string; success?: boolean }>;
}

export default function QuotesPageContent({
  initialQuotes,
  createQuote,
  updateQuote,
  deleteQuote,
}: QuotesPageContentProps) {
  const [quotes, setQuotes] = useState<Quote[]>(initialQuotes);
  const [selectedQuoteId, setSelectedQuoteId] = useState<string | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  const handleQuoteClick = (quoteId: string) => {
    setSelectedQuoteId(quoteId);
    setIsDrawerOpen(true);
  };

  const handleCloseDrawer = () => {
    setSelectedQuoteId(null);
    setIsDrawerOpen(false);
  };

  const handleCreateQuote = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const result = await createQuote(formData);
    if (result.success) {
      // Refresh quotes list
      window.location.reload();
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Quotes</h1>
          <p className="text-gray-600">Manage your rental quotes</p>
        </div>

        {/* Create Quote Form */}
        <form
          onSubmit={handleCreateQuote}
          className="mb-6 p-4 bg-white rounded-lg shadow-sm border border-gray-200"
        >
          <div className="flex gap-4 items-end">
            <div className="flex-1">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Quote Name
              </label>
              <input
                type="text"
                name="name"
                required
                placeholder="e.g., Summer Event 2024"
                className="w-full px-3 py-2 bg-white text-gray-900 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Start Date
              </label>
              <input
                type="date"
                name="start_date"
                required
                className="px-3 py-2 bg-white text-gray-900 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                End Date
              </label>
              <input
                type="date"
                name="end_date"
                required
                className="px-3 py-2 bg-white text-gray-900 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <button
              type="submit"
              className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors font-medium"
            >
              Create Quote
            </button>
          </div>
        </form>

        {/* Quotes List */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200">
          {quotes.length === 0 ? (
            <div className="p-8 text-center text-gray-500">
              No quotes yet. Create your first quote above.
            </div>
          ) : (
            <div className="divide-y divide-gray-200">
              {quotes.map((quote) => {
                const startDate = new Date(quote.start_date);
                const endDate = new Date(quote.end_date);
                const days = Math.ceil(
                  (endDate.getTime() - startDate.getTime()) /
                    (1000 * 60 * 60 * 24),
                );

                return (
                  <div
                    key={quote.id}
                    onClick={() => handleQuoteClick(quote.id)}
                    className="p-4 hover:bg-gray-50 transition-colors cursor-pointer"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <h3 className="text-lg font-semibold text-gray-900">
                          {quote.name}
                        </h3>
                        <p className="text-sm text-gray-600 mt-1">
                          {startDate.toLocaleDateString()} -{" "}
                          {endDate.toLocaleDateString()} ({days} days)
                        </p>
                      </div>
                      <div className="flex items-center gap-4">
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
                          {quote.status.charAt(0).toUpperCase() +
                            quote.status.slice(1)}
                        </span>
                        <svg
                          className="w-5 h-5 text-gray-400"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M9 5l7 7-7 7"
                          />
                        </svg>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Quote Drawer */}
      {selectedQuoteId && (
        <QuoteDetailDrawer
          quoteId={selectedQuoteId}
          isDrawerOpen={isDrawerOpen}
          onClose={handleCloseDrawer}
          updateQuote={updateQuote}
          deleteQuote={deleteQuote}
        />
      )}
    </div>
  );
}
