"use client";

export default function QuotesPage() {
  const handleNewQuote = () => {
    // Placeholder: just log for now
    console.log("New Quote button clicked");
    alert("New Quote functionality coming soon!");
  };

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Quotes</h1>
          <p className="text-gray-600">Manage your rental quotes</p>
        </div>

        {/* Empty State */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-12">
          <div className="text-center">
            <svg
              className="mx-auto h-12 w-12 text-gray-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
              />
            </svg>
            <h3 className="mt-4 text-lg font-semibold text-gray-900">
              No quotes yet
            </h3>
            <p className="mt-2 text-sm text-gray-500">
              Get started by creating your first quote.
            </p>
            <div className="mt-6">
              <button
                onClick={handleNewQuote}
                className="inline-flex items-center px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 transition-colors"
              >
                <svg
                  className="mr-2 h-5 w-5"
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
                New Quote
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
