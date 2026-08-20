import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';

const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3001';

export default function MyBookings() {
  const { token, user } = useAuth();
  const [bookings, setBookings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (token && user?.role === 'CUSTOMER') {
      fetchBookings();
    }
  }, [token, user]);

  const fetchBookings = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${apiUrl}/api/bookings/my`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        setBookings(await res.json());
      }
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = async (bookingRef: string) => {
    if (!confirm('Cancel this booking? Seats will be released to waitlist.')) return;
    try {
      const res = await fetch(`${apiUrl}/api/bookings/${bookingRef}/cancel`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        alert('Booking cancelled');
        fetchBookings();
      } else {
        const data = await res.json();
        alert(data.error || 'Cancel failed');
      }
    } catch {
      alert('Cancel failed');
    }
  };

  if (user?.role !== 'CUSTOMER') {
    return <div className="p-4 text-red-600">Customer only</div>;
  }

  if (loading) return <div className="p-4 text-center">Loading...</div>;

  return (
    <div className="container mx-auto p-4">
      <h1 className="text-3xl font-bold mb-6">My Bookings</h1>

      {bookings.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-lg shadow">
          <p className="text-gray-600 mb-4">No bookings yet</p>
          <a href="/browse" className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 inline-block">
            Browse Events
          </a>
        </div>
      ) : (
        <div className="space-y-4">
          {bookings.map((booking) => (
            <div key={booking.id} className="bg-white p-6 rounded-lg shadow">
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h2 className="text-xl font-bold">{booking.show.title}</h2>
                  <p className="text-gray-600">
                    {booking.show.venue.name} • {new Date(booking.show.startsAt).toLocaleString()}
                  </p>
                </div>
                <span
                  className={`px-3 py-1 rounded text-sm font-semibold ${
                    booking.status === 'CONFIRMED'
                      ? 'bg-green-100 text-green-800'
                      : 'bg-gray-100 text-gray-800'
                  }`}
                >
                  {booking.status}
                </span>
              </div>

              <div className="grid md:grid-cols-3 gap-4">
                <div>
                  <p className="text-sm text-gray-600">Booking Ref</p>
                  <p className="font-semibold">{booking.bookingRef}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Seats</p>
                  <p className="font-semibold">
                    {booking.seats
                      .map((bs: any) => `${bs.showSeat.seat.rowLabel}${bs.showSeat.seat.seatNumber}`)
                      .join(', ')}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Total</p>
                  <p className="font-semibold text-green-600">
                    ${(booking.totalCents / 100).toFixed(2)}
                  </p>
                </div>
              </div>

              <div className="mt-4 flex justify-between items-center">
                <div className="text-sm text-gray-500">
                  Booked on {new Date(booking.createdAt).toLocaleString()}
                </div>
                {booking.status === 'CONFIRMED' && (
                  <button
                    onClick={() => handleCancel(booking.bookingRef)}
                    className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 text-sm"
                  >
                    Cancel Booking
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
