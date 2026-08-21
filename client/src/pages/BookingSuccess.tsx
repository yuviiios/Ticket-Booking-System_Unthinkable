import { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3001';

export default function BookingSuccess() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { token } = useAuth();
  const [booking, setBooking] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const bookingRef = searchParams.get('ref');

  useEffect(() => {
    if (!token || !bookingRef) {
      navigate('/bookings');
      return;
    }

    const fetchBooking = async () => {
      try {
        const res = await fetch(`${apiUrl}/api/bookings/${bookingRef}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) {
          setBooking(await res.json());
        } else {
          navigate('/bookings');
        }
      } catch {
        navigate('/bookings');
      } finally {
        setLoading(false);
      }
    };

    fetchBooking();
  }, [token, bookingRef, navigate]);

  if (loading) return <div className="p-4 text-center">Loading...</div>;
  if (!booking) return <div className="p-4 text-center">Booking not found</div>;

  return (
    <div className="container mx-auto p-4 max-w-2xl">
      <div className="bg-green-50 border border-green-200 rounded-lg p-8 text-center mb-6">
        <h1 className="text-4xl font-bold text-green-600 mb-2">🎉 Booking Confirmed!</h1>
        <p className="text-gray-700">Your tickets are ready</p>
      </div>

      <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
        <div className="grid md:grid-cols-2 gap-6">
          <div>
            <h2 className="text-xl font-bold mb-4">{booking.show.title}</h2>
            <div className="space-y-3 text-sm">
              <div>
                <p className="text-gray-600">Booking Reference</p>
                <p className="font-mono font-bold text-lg">{booking.bookingRef}</p>
              </div>
              <div>
                <p className="text-gray-600">Venue</p>
                <p className="font-semibold">{booking.show.venue.name}</p>
              </div>
              <div>
                <p className="text-gray-600">Date & Time</p>
                <p className="font-semibold">{new Date(booking.show.startsAt).toLocaleString()}</p>
              </div>
              <div>
                <p className="text-gray-600">Seats</p>
                <div className="flex flex-wrap gap-2 mt-2">
                  {booking.seats.map((bs: any) => (
                    <span key={bs.id} className="bg-blue-100 text-blue-800 px-3 py-1 rounded font-semibold">
                      {bs.showSeat.seat.rowLabel}{bs.showSeat.seat.seatNumber}
                    </span>
                  ))}
                </div>
              </div>
              <div className="border-t pt-3 mt-3">
                <p className="text-gray-600">Total Amount</p>
                <p className="text-2xl font-bold text-green-600">${(booking.totalCents / 100).toFixed(2)}</p>
              </div>
            </div>
          </div>

          <div className="flex flex-col items-center justify-center bg-gray-50 rounded-lg p-6">
            <p className="text-gray-600 text-sm mb-3">Show this QR at venue:</p>
            <div className="bg-white p-4 rounded border border-gray-300">
              <img
                src={`${apiUrl}/api/bookings/qr/${booking.bookingRef}`}
                alt="QR Code"
                width="200"
                className="rounded"
              />
            </div>
            <p className="text-xs text-gray-500 mt-4 text-center">
              QR code also sent to {booking.customer?.email}
            </p>
          </div>
        </div>
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
        <p className="text-blue-900 text-sm">
          <strong>Important:</strong> A confirmation email with your QR code has been sent. Keep this reference safe: <code className="font-mono font-bold">{booking.bookingRef}</code>
        </p>
      </div>

      <div className="flex gap-3 justify-center">
        <button
          onClick={() => navigate('/browse')}
          className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-semibold"
        >
          Browse More Events
        </button>
        <button
          onClick={() => navigate('/bookings')}
          className="px-6 py-3 bg-gray-300 text-gray-900 rounded-lg hover:bg-gray-400 font-semibold"
        >
          View All Bookings
        </button>
      </div>
    </div>
  );
}
