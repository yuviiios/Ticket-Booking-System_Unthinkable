import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useVenues } from '../hooks/useVenues';
import { useShows } from '../hooks/useShows';

export default function OrganiserShows() {
  const { user } = useAuth();
  const { venues } = useVenues();
  const { createShow, publishShow, fetchMyShows } = useShows();
  const [myShows, setMyShows] = useState<any[]>([]);
  const [error, setError] = useState('');

  const [venueId, setVenueId] = useState(0);
  const [title, setTitle] = useState('');
  const [type, setType] = useState<'MOVIE' | 'CONCERT'>('MOVIE');
  const [description, setDescription] = useState('');
  const [startsAt, setStartsAt] = useState('');
  const [selectedVenue, setSelectedVenue] = useState<any>(null);
  const [prices, setPrices] = useState<Array<{ categoryId: number; priceCents: number }>>([]);

  useEffect(() => {
    if (user?.role === 'ORGANISER') {
      fetchMyShows().then(setMyShows);
    }
  }, [user]);

  useEffect(() => {
    if (venueId) {
      const venue = venues.find((v) => v.id === venueId);
      setSelectedVenue(venue);
      if (venue?.categories) {
        setPrices(venue.categories.map((cat) => ({ categoryId: cat.id, priceCents: 1000 })));
      }
    }
  }, [venueId, venues]);

  if (user?.role !== 'ORGANISER') {
    return <div className="p-4 text-red-600">Organiser only</div>;
  }

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    const result = await createShow({
      venueId,
      title,
      type,
      description,
      startsAt,
      prices,
    });
    if (result) {
      setTitle('');
      setDescription('');
      setStartsAt('');
      fetchMyShows().then(setMyShows);
    } else {
      setError('Create failed');
    }
  };

  const handlePublish = async (showId: number) => {
    const result = await publishShow(showId);
    if (result) {
      alert(`Published! ${result.seatsCreated} seats created`);
      fetchMyShows().then(setMyShows);
    } else {
      alert('Publish failed');
    }
  };

  const updatePrice = (categoryId: number, priceCents: number) => {
    setPrices(prices.map((p) => (p.categoryId === categoryId ? { ...p, priceCents } : p)));
  };

  return (
    <div className="container mx-auto p-4">
      <h1 className="text-3xl font-bold mb-6">Manage Shows</h1>

      <div className="grid md:grid-cols-2 gap-6">
        {/* Create Form */}
        <div className="bg-white p-6 rounded-lg shadow">
          <h2 className="text-xl font-bold mb-4">Create Show</h2>
          {error && <div className="mb-4 p-3 bg-red-100 text-red-700 rounded">{error}</div>}
          <form onSubmit={handleCreate} className="space-y-4">
            <select
              value={venueId}
              onChange={(e) => setVenueId(parseInt(e.target.value))}
              className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            >
              <option value={0}>Select Venue</option>
              {venues.map((venue) => (
                <option key={venue.id} value={venue.id}>
                  {venue.name} - {venue.city}
                </option>
              ))}
            </select>
            <input
              type="text"
              placeholder="Show Title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-4 py-2 border rounded-lg"
              required
            />
            <select
              value={type}
              onChange={(e) => setType(e.target.value as any)}
              className="w-full px-4 py-2 border rounded-lg"
            >
              <option value="MOVIE">Movie</option>
              <option value="CONCERT">Concert</option>
            </select>
            <textarea
              placeholder="Description (optional)"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full px-4 py-2 border rounded-lg"
              rows={3}
            />
            <input
              type="datetime-local"
              value={startsAt}
              onChange={(e) => setStartsAt(e.target.value)}
              className="w-full px-4 py-2 border rounded-lg"
              required
            />

            {selectedVenue && selectedVenue.categories && (
              <div>
                <h3 className="font-semibold mb-2">Pricing (cents)</h3>
                {selectedVenue.categories.map((cat: any) => {
                  const price = prices.find((p) => p.categoryId === cat.id);
                  return (
                    <div key={cat.id} className="flex items-center gap-2 mb-2">
                      <div
                        className="w-4 h-4 rounded border"
                        style={{ backgroundColor: cat.colorHex }}
                      ></div>
                      <span className="flex-1">{cat.name}</span>
                      <input
                        type="number"
                        value={price?.priceCents || 1000}
                        onChange={(e) => updatePrice(cat.id, parseInt(e.target.value))}
                        className="w-24 px-2 py-1 border rounded"
                        min="0"
                        step="100"
                      />
                    </div>
                  );
                })}
              </div>
            )}

            <button
              type="submit"
              disabled={!venueId}
              className="w-full bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700 disabled:bg-gray-400"
            >
              Create Show (Draft)
            </button>
          </form>
        </div>

        {/* My Shows */}
        <div className="bg-white p-6 rounded-lg shadow">
          <h2 className="text-xl font-bold mb-4">My Shows</h2>
          <div className="space-y-3 max-h-96 overflow-y-auto">
            {myShows.map((show) => (
              <div key={show.id} className="p-3 border rounded bg-gray-50">
                <div className="flex justify-between items-start mb-2">
                  <div>
                    <div className="font-semibold">{show.title}</div>
                    <div className="text-sm text-gray-600">
                      {show.venue.name} • {new Date(show.startsAt).toLocaleString()}
                    </div>
                  </div>
                  <span
                    className={`px-2 py-1 text-xs rounded ${
                      show.status === 'PUBLISHED'
                        ? 'bg-green-100 text-green-800'
                        : 'bg-yellow-100 text-yellow-800'
                    }`}
                  >
                    {show.status}
                  </span>
                </div>
                {show.status === 'DRAFT' && (
                  <button
                    onClick={() => handlePublish(show.id)}
                    className="mt-2 px-4 py-1 bg-green-600 text-white rounded text-sm hover:bg-green-700"
                  >
                    Publish
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
