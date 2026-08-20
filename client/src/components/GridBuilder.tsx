import { useState, useEffect } from 'react';
import { useVenues } from '../hooks/useVenues';

interface GridBuilderProps {
  venueId: number;
  categories: Array<{ id: number; name: string; colorHex: string }>;
  onGenerate: (rows: number, cols: number, mapping: any) => Promise<void>;
}

export default function GridBuilder({ venueId, categories, onGenerate }: GridBuilderProps) {
  const [rows, setRows] = useState(5);
  const [cols, setCols] = useState(10);
  const [categoryRows, setCategoryRows] = useState<Array<{ endRow: number; categoryId: number }>>(
    categories.length > 0 ? [{ endRow: rows - 1, categoryId: categories[0].id }] : []
  );
  const [loading, setLoading] = useState(false);

  const handleAddMapping = () => {
    setCategoryRows([
      ...categoryRows,
      { endRow: rows - 1, categoryId: categories[0]?.id || 1 },
    ]);
  };

  const handleUpdateMapping = (idx: number, field: string, value: any) => {
    const updated = [...categoryRows];
    (updated[idx] as any)[field] = value;
    setCategoryRows(updated);
  };

  const handleRemoveMapping = (idx: number) => {
    setCategoryRows(categoryRows.filter((_, i) => i !== idx));
  };

  const handleGenerate = async () => {
    setLoading(true);
    try {
      await onGenerate(rows, cols, categoryRows);
      alert(`Generated ${rows * cols} seats`);
    } catch {
      alert('Generation failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white p-6 rounded-lg shadow mt-6">
      <h2 className="text-xl font-bold mb-4">Seat Layout Generator</h2>

      <div className="grid md:grid-cols-2 gap-4 mb-6">
        <div>
          <label className="block text-sm font-semibold mb-2">Rows (A–Z)</label>
          <input
            type="number"
            min="1"
            max="26"
            value={rows}
            onChange={(e) => setRows(parseInt(e.target.value))}
            className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div>
          <label className="block text-sm font-semibold mb-2">Cols</label>
          <input
            type="number"
            min="1"
            max="50"
            value={cols}
            onChange={(e) => setCols(parseInt(e.target.value))}
            className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>

      <h3 className="font-semibold mb-3">Category Mapping</h3>
      <div className="space-y-3 mb-4">
        {categoryRows.map((mapping, idx) => (
          <div key={idx} className="flex items-center gap-2 p-3 bg-gray-50 rounded">
            <span className="text-sm">Rows 0–</span>
            <input
              type="number"
              min="0"
              max={rows - 1}
              value={mapping.endRow}
              onChange={(e) => handleUpdateMapping(idx, 'endRow', parseInt(e.target.value))}
              className="w-12 px-2 py-1 border rounded text-center"
            />
            <select
              value={mapping.categoryId}
              onChange={(e) => handleUpdateMapping(idx, 'categoryId', parseInt(e.target.value))}
              className="px-2 py-1 border rounded flex-1"
            >
              {categories.map((cat) => (
                <option key={cat.id} value={cat.id}>
                  {cat.name}
                </option>
              ))}
            </select>
            <button
              onClick={() => handleRemoveMapping(idx)}
              className="px-3 py-1 bg-red-500 text-white rounded text-sm hover:bg-red-600"
            >
              Remove
            </button>
          </div>
        ))}
      </div>

      <button
        onClick={handleAddMapping}
        className="mb-4 px-4 py-2 bg-gray-300 text-gray-700 rounded hover:bg-gray-400"
      >
        Add Mapping
      </button>

      <button
        onClick={handleGenerate}
        disabled={loading || categoryRows.length === 0}
        className="w-full px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 disabled:bg-gray-400"
      >
        {loading ? 'Generating...' : `Generate ${rows * cols} Seats`}
      </button>
    </div>
  );
}
