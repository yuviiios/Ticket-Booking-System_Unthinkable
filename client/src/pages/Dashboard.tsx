import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';

const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3001';

export default function Dashboard() {
  const { token, user } = useAuth();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (token && user?.role === 'ORGANISER') {
      fetchDashboard();
    }
  }, [token, user]);

  const fetchDashboard = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${apiUrl}/api/dashboard/organiser`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        setData(await res.json());
      }
    } finally {
      setLoading(false);
    }
  };

  if (user?.role !== 'ORGANISER') {
    return <div className="p-4 text-red-600">Organiser only</div>;
  }

  if (loading) return <div className="p-4 text-center">Loading...</div>;
  if (!data) return <div className="p-4 text-center text-red-600">No data</div>;

  const { summary, shows } = data;

  return (
    <div className="container mx-auto p-4">
      <h1 className="text-3xl font-bold mb-6">Dashboard</h1>

      {/* Summary Cards */}
      <div className="grid md:grid-cols-4 gap-4 mb-6">
        <div className="bg-white p-6 rounded-lg shadow">
          <div className="text-sm text-gray-600 mb-1">Total Revenue</div>
          <div className="text-3xl font-bold text-green-600">
            ${(summary.totalRevenue / 100).toFixed(2)}
          </div>
        </div>
        <div className="bg-white p-6 rounded-lg shadow">
          <div className="text-sm text-gray-600 mb-1">Total Bookings</div>
          <div className="text-3xl font-bold text-blue-600">{summary.totalBookings}</div>
        </div>
        <div className="bg-white p-6 rounded-lg shadow">
          <div className="text-sm text-gray-600 mb-1">Total Shows</div>
          <div className="text-3xl font-bold text-purple-600">{summary.totalShows}</div>
        </div>
        <div className="bg-white p-6 rounded-lg shadow">
          <div className="text-sm text-gray-600 mb-1">Avg Occupancy</div>
          <div className="text-3xl font-bold text-orange-600">{summary.avgOccupancy}%</div>
        </div>
      </div>

      {/* Shows Breakdown */}
      <div className="bg-white rounded-lg shadow">
        <div className="p-6 border-b">
          <h2 className="text-xl font-bold">Shows Performance</h2>
        </div>

        {shows.length === 0 ? (
          <div className="p-12 text-center text-gray-600">
            <p className="mb-4">No shows yet</p>
            <a
              href="/organiser/shows"
              className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 inline-block"
            >
              Create Your First Show
            </a>
          </div>
        ) : (
          <div className="divide-y">
            {shows.map((show: any) => (
              <div key={show.showId} className="p-6">
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <h3 className="text-lg font-bold">{show.title}</h3>
                    <p className="text-sm text-gray-600">
                      {show.venue}, {show.city} • {new Date(show.startsAt).toLocaleDateString()}
                    </p>
                  </div>
                  <span
                    className={`px-3 py-1 rounded text-sm font-semibold ${
                      show.status === 'PUBLISHED'
                        ? 'bg-green-100 text-green-800'
                        : show.status === 'DRAFT'
                        ? 'bg-yellow-100 text-yellow-800'
                        : 'bg-gray-100 text-gray-800'
                    }`}
                  >
                    {show.status}
                  </span>
                </div>

                <div className="grid md:grid-cols-5 gap-4 mb-4">
                  <div>
                    <div className="text-xs text-gray-600 mb-1">Revenue</div>
                    <div className="text-lg font-bold text-green-600">
                      ${(show.totalRevenue / 100).toFixed(2)}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-gray-600 mb-1">Bookings</div>
                    <div className="text-lg font-bold">{show.bookingCount}</div>
                  </div>
                  <div>
                    <div className="text-xs text-gray-600 mb-1">Occupancy</div>
                    <div className="text-lg font-bold text-blue-600">{show.occupancyRate}%</div>
                  </div>
                  <div>
                    <div className="text-xs text-gray-600 mb-1">Booked</div>
                    <div className="text-lg font-bold">{show.bookedSeats}</div>
                  </div>
                  <div>
                    <div className="text-xs text-gray-600 mb-1">Available</div>
                    <div className="text-lg font-bold">{show.availableSeats}</div>
                  </div>
                </div>

                {/* Occupancy Bar */}
                <div className="mb-4">
                  <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-blue-600 transition-all"
                      style={{ width: `${show.occupancyRate}%` }}
                    ></div>
                  </div>
                </div>

                {/* Category Breakdown */}
                {show.categoryBreakdown.length > 0 && (
                  <div>
                    <div className="text-sm font-semibold text-gray-700 mb-2">
                      Revenue by Category
                    </div>
                    <div className="grid md:grid-cols-3 gap-3">
                      {show.categoryBreakdown.map((cat: any, idx: number) => (
                        <div key={idx} className="bg-gray-50 p-3 rounded border">
                          <div className="text-xs text-gray-600">{cat.name}</div>
                          <div className="flex justify-between items-end mt-1">
                            <div className="text-lg font-bold text-green-600">
                              ${(cat.revenue / 100).toFixed(2)}
                            </div>
                            <div className="text-sm text-gray-600">{cat.seats} seats</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
