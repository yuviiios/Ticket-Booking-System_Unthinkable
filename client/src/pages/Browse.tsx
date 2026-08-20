import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useShows } from '../hooks/useShows';

export default function Browse() {
  const { shows, fetchShows, loading } = useShows();
  const [typeFilter, setTypeFilter] = useState('');
  const [cityFilter, setCityFilter] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    fetchShows({ type: typeFilter || undefined, city: cityFilter || undefined });
  }, [typeFilter, cityFilter]);

  const cities = Array.from(new Set(shows.map((s) => s.venue.city)));

  return (
    <div className="container mx-auto p-4">
      <h1 className="text-3xl font-bold mb-6">Browse Events</h1>

      {/* Filters */}
      <div className="mb-6 bg-white p-4 rounded-lg shadow flex gap-4">
        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
          className="px-4 py-2 border rounded-lg"
        >
          <option value="">All Types</option>
          <option value="MOVIE">Movies</option>
          <option value="CONCERT">Concerts</option>
        </select>
        <select
          value={cityFilter}
          onChange={(e) => setCityFilter(e.target.value)}
          className="px-4 py-2 border rounded-lg"
        >
          <option value="">All Cities</option>
          {cities.map((city) => (
            <option key={city} value={city}>
              {city}
            </option>
          ))}
        </select>
      </div>

      {/* Shows Grid */}
      {loading ? (
        <div className="text-center py-8 text-gray-600">Loading...</div>
      ) : shows.length === 0 ? (
        <div className="text-center py-8 text-gray-600">No shows found</div>
      ) : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {shows.map((show) => (
            <div
              key={show.id}
              className="bg-white p-6 rounded-lg shadow hover:shadow-lg transition cursor-pointer"
              onClick={() => navigate(`/shows/${show.id}`)}
            >
              <div className="mb-3">
                <h2 className="text-xl font-bold text-gray-900">{show.title}</h2>
                <span className="text-xs px-2 py-1 bg-blue-100 text-blue-800 rounded">
                  {show.type}
                </span>
              </div>
              <div className="text-sm text-gray-600 space-y-1 mb-4">
                <div>📍 {show.venue.name}, {show.venue.city}</div>
                <div>📅 {new Date(show.startsAt).toLocaleString()}</div>
                <div>👤 {show.organiser.name}</div>
              </div>
              {show.prices && show.prices.length > 0 && (
                <div>
                  <div className="text-sm font-semibold text-gray-700 mb-2">Pricing</div>
                  <div className="space-y-1">
                    {show.prices.map((p) => (
                      <div key={p.id} className="flex items-center gap-2 text-sm">
                        <div
                          className="w-3 h-3 rounded border"
                          style={{ backgroundColor: p.category.colorHex }}
                        ></div>
                        <span className="flex-1">{p.category.name}</span>
                        <span className="font-semibold">${(p.priceCents / 100).toFixed(2)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              <button className="mt-4 w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
                View Details
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
