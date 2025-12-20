"use client";

interface Stock {
  total_quantity: number;
  out_of_service_quantity: number;
}

interface StockEditorProps {
  stock: Stock | null;
  isLoadingStock: boolean;
  isSavingStock: boolean;
  stockError: string | null;
  onStockChange: (
    field: "total_quantity" | "out_of_service_quantity",
    value: string,
  ) => void;
  onStockSave: () => void;
}

export default function StockEditor({
  stock,
  isLoadingStock,
  isSavingStock,
  stockError,
  onStockChange,
  onStockSave,
}: StockEditorProps) {
  if (isLoadingStock) {
    return (
      <div>
        <h4 className="text-sm font-semibold text-gray-700 mb-3">Stock</h4>
        <div className="text-sm text-gray-500 py-2">Loading stock...</div>
      </div>
    );
  }

  if (!stock) {
    return (
      <div>
        <h4 className="text-sm font-semibold text-gray-700 mb-3">Stock</h4>
        <div className="text-sm text-gray-500 py-2">
          {stockError || "No stock data"}
        </div>
      </div>
    );
  }

  return (
    <div>
      <h4 className="text-sm font-semibold text-gray-700 mb-3">Stock</h4>
      <div className="space-y-3">
        <div>
          <label className="block text-xs text-gray-600 mb-1">
            Total Quantity
          </label>
          <input
            type="number"
            min="0"
            value={stock.total_quantity}
            onChange={(e) => onStockChange("total_quantity", e.target.value)}
            onBlur={onStockSave}
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
              onStockChange("out_of_service_quantity", e.target.value)
            }
            onBlur={onStockSave}
            disabled={isSavingStock}
            className="w-full px-3 py-2 bg-white text-gray-900 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
          />
        </div>
        <div className="pt-2 border-t border-gray-200">
          <div className="flex justify-between items-center">
            <span className="text-xs text-gray-600">Available</span>
            <span className="text-sm font-semibold text-gray-900">
              {stock.total_quantity - stock.out_of_service_quantity}
            </span>
          </div>
        </div>
        {isSavingStock && (
          <div className="text-xs text-gray-500">Saving...</div>
        )}
        {stockError && <div className="text-xs text-red-600">{stockError}</div>}
      </div>
    </div>
  );
}
