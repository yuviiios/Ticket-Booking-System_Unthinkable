import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';

const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3001';

export default function MyWaitlist() {
  const { token, user } = useAuth();
  const [entries, setEntries] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (token && user?.role === 'CUSTOMER') {
      fetchEntries();
    }
  }, [token, user]);

  const fetchEntries = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${apiUrl}/api/waitlist/my`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        setEntries(await res.json());
      }
    } finally {
      setLoading(false);
    }
  };

  const handleLeave = async (entryId: number) => {
    if (!confirm('Leave waitlist?')) return;
    try {
      const res = await fetch(`${apiUrl}/api/waitlist/${entryId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        fetchEntries();
      }
    } catch {
      alert('Leave failed');
    }
  };

  if (user?.role !== 'CUSTOMER') {
    return <div className="p-4 text-red-600">Customer only</div>;
  }

  if (loading) return <div className="p-4 text-center">Loading...</div>;

  return (
    <div className="container mx-auto p-4">
      <h1 className="text-3xl font-bold mb-6">My Waitlist</h1>

      {entries.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-lg shadow">
          <p className="text-gray-600 mb-4">No waitlist entries</p>
          <a href="/browse" className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 inline-block">
            Browse Events
          </a>
        </div>
      ) : (
        <div className="space-y-4">
          {entries.map((entry) => (
            <div key={entry.id} className="bg-white p-6 rounded-lg shadow">
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h2 className="text-xl font-bold">{entry.show.title}</h2>
                  <p className="text-gray-600">
                    {entry.show.venue.name} • {new Date(entry.show.startsAt).toLocaleString()}
                  </p>
                </div>
                <span
                  className={`px-3 py-1 rounded text-sm font-semibold ${
                    entry.status === 'OFFERED'
                      ? 'bg-yellow-100 text-yellow-800'
                      : entry.status === 'CONVERTED'
                      ? 'bg-green-100 text-green-800'
                      : 'bg-gray-100 text-gray-800'
                  }`}
                >
                  {entry.status}
                </span>
              </div>

              <div className="grid md:grid-cols-3 gap-4 mb-4">
                <div>
                  <p className="text-sm text-gray-600">Category</p>
                  <p className="font-semibold">{entry.category.name}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Seats Wanted</p>
                  <p className="font-semibold">{entry.seatsWanted}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Joined</p>
                  <p className="font-semibold">{new Date(entry.createdAt).toLocaleDateString()}</p>
                </div>
              </div>

              {entry.status === 'OFFERED' && entry.offers && entry.offers.length > 0 && (
                <div className="p-3 bg-yellow-50 border border-yellow-200 rounded mb-4">
                  <p className="font-semibold text-yellow-800 mb-2">Seats Available!</p>
                  <p className="text-sm text-gray-700 mb-3">
                    Expires: {new Date(entry.offers[0].expiresAt).toLocaleString()}
                  </p>
                  <a
                    href={`/waitlist/accept/${entry.offers[0].token}`}
                    className="px-4 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 inline-block"
                  >
                    Accept Offer
                  </a>
                </div>
              )}

              {entry.status === 'WAITING' && (
                <button
                  onClick={() => handleLeave(entry.id)}
                  className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
                >
                  Leave Waitlist
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
