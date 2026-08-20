import { useState } from 'react';
import { useVenues } from '../hooks/useVenues';
import { useAuth } from '../context/AuthContext';
import GridBuilder from '../components/GridBuilder';

export default function AdminVenues() {
  const { user } = useAuth();
  const { venues, createVenue, createCategory, fetchVenue, bulkSeats } = useVenues();
  const [name, setName] = useState('');
  const [city, setCity] = useState('');
  const [address, setAddress] = useState('');
  const [selected, setSelected] = useState<number | null>(null);
  const [selectedVenue, setSelectedVenue] = useState<any>(null);
  const [error, setError] = useState('');
  const [catName, setCatName] = useState('');
  const [catColor, setCatColor] = useState('#FFD700');

  if (user?.role !== 'ADMIN') {
    return <div className="p-4 text-red-600">Admin only</div>;
  }

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    const result = await createVenue(name, city, address);
    if (result) {
      setName('');
      setCity('');
      setAddress('');
    } else {
      setError('Create failed');
    }
  };

  const handleSelect = async (venueId: number) => {
    const venue = await fetchVenue(venueId);
    setSelected(venueId);
    setSelectedVenue(venue);
  };

  const handleAddCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!selected) return;
    const result = await createCategory(selected, catName, catColor);
    if (result) {
      setCatName('');
      setCatColor('#FFD700');
      handleSelect(selected);
    } else {
      setError('Add category failed');
    }
  };

  const handleBulkSeats = async (rows: number, cols: number, categoryRows: any) => {
    if (!selected) return;
    const result = await bulkSeats(selected, rows, cols, categoryRows);
    if (result) {
      handleSelect(selected);
    }
  };

  return (
    <div className="container mx-auto p-4">
      <h1 className="text-3xl font-bold mb-6">Venue Management</h1>

      <div className="grid md:grid-cols-2 gap-6">
        {/* Create Venue */}
        <div className="bg-white p-6 rounded-lg shadow">
          <h2 className="text-xl font-bold mb-4">Create Venue</h2>
          {error && <div className="mb-4 p-3 bg-red-100 text-red-700 rounded">{error}</div>}
          <form onSubmit={handleCreate} className="space-y-4">
            <input
              type="text"
              placeholder="Venue Name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            />
            <input
              type="text"
              placeholder="City"
              value={city}
              onChange={(e) => setCity(e.target.value)}
              className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            />
            <input
              type="text"
              placeholder="Address"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            />
            <button
              type="submit"
              className="w-full bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700"
            >
              Create
            </button>
          </form>
        </div>

        {/* Venues List */}
        <div className="bg-white p-6 rounded-lg shadow">
          <h2 className="text-xl font-bold mb-4">Venues</h2>
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {venues.map((venue) => (
              <button
                key={venue.id}
                onClick={() => handleSelect(venue.id)}
                className={`w-full text-left p-3 rounded border transition ${
                  selected === venue.id
                    ? 'bg-blue-100 border-blue-500'
                    : 'bg-gray-50 border-gray-200 hover:bg-gray-100'
                }`}
              >
                <div className="font-semibold">{venue.name}</div>
                <div className="text-sm text-gray-600">
                  {venue.city} • {venue.address}
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Venue Detail */}
      {selectedVenue && (
        <>
          <div className="mt-6 bg-white p-6 rounded-lg shadow">
            <h2 className="text-xl font-bold mb-4">{selectedVenue.name}</h2>
            <div className="grid md:grid-cols-3 gap-4">
              <div>
                <h3 className="font-semibold text-gray-700">Categories</h3>
                <div className="mt-2 space-y-1">
                  {selectedVenue.categories?.map((cat: any) => (
                    <div
                      key={cat.id}
                      className="flex items-center gap-2 p-2 bg-gray-50 rounded"
                    >
                      <div
                        className="w-4 h-4 rounded border"
                        style={{ backgroundColor: cat.colorHex }}
                      ></div>
                      <span>{cat.name}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div>
                <h3 className="font-semibold text-gray-700">Seats</h3>
                <p className="mt-2 text-gray-600">
                  {selectedVenue.seats?.length || 0} total
                </p>
              </div>
              <div>
                <h3 className="font-semibold text-gray-700">Layout</h3>
                {selectedVenue.seats && selectedVenue.seats.length > 0 && (
                  <p className="mt-2 text-gray-600">
                    {Math.max(...selectedVenue.seats.map((s: any) => s.gridRow)) + 1} rows ×{' '}
                    {Math.max(...selectedVenue.seats.map((s: any) => s.gridCol)) + 1} cols
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Add Category */}
          <div className="mt-6 bg-white p-6 rounded-lg shadow">
            <h2 className="text-xl font-bold mb-4">Add Category</h2>
            <form onSubmit={handleAddCategory} className="grid md:grid-cols-4 gap-3">
              <input
                type="text"
                placeholder="Category Name"
                value={catName}
                onChange={(e) => setCatName(e.target.value)}
                className="px-4 py-2 border rounded-lg"
                required
              />
              <input
                type="color"
                value={catColor}
                onChange={(e) => setCatColor(e.target.value)}
                className="px-4 py-2 border rounded-lg"
              />
              <button
                type="submit"
                className="md:col-span-2 bg-green-600 text-white py-2 rounded-lg hover:bg-green-700"
              >
                Add
              </button>
            </form>
          </div>

          {/* Grid Builder */}
          <GridBuilder
            venueId={selected!}
            categories={selectedVenue.categories || []}
            onGenerate={handleBulkSeats}
          />
        </>
      )}
    </div>
  );
}
